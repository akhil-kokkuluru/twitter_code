const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const DBpath = path.join(__dirname, "twitterClone.db");
let db = null;
const app = express();

app.use(express.json());

const serverInitilization = async () => {
  try {
    db = await open({
      filename: DBpath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("SERVER UP AND RUNNING SUCCESSFULLY AT PORT 3000");
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};

serverInitilization();

module.exports = app;

// UTILITIES

const passwordCheck = (wordstring) => {
  if (wordstring.length < 6) {
    return false;
  } else {
    return true;
  }
};

const jwtTokenAuthentication = (request, response, next) => {
  let jwtGiven;
  const authHeader = request.headers["authorization"];
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtGiven = authHeader.split(" ")[1];
    const jwtVerification = jwt.verify(
      jwtGiven,
      "akhil_code",
      async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      }
    );
  }
};

const dateFormat = (argument) => {
  let formattedTweet = {
    username: argument.username,
    tweet: argument.tweet,
    dateTime: argument.date_time,
  };
  return formattedTweet;
};

const dateFormatTwo = (arg) => {
  let formatted = {
    tweet: arg.tweet,
    likes: arg.likes,
    replies: arg.replies,
    dateTime: arg.date_time,
  };
  return formatted;
};

const likesFormat = (likes) => {
  let { username } = likes;
  return username;
};

// 1) POST API: /register/

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const encryptedPassword = await bcrypt.hash(request.body.password, 10);
  const userCheckingQuery = `
    SELECT
    *
    FROM
    user
    WHERE username = "${username}";`;
  const userPostingQuery = `
  INSERT INTO
    user(username, password, name, gender)
  VALUES("${username}","${encryptedPassword}","${name}","${gender}");`;
  const userExistance = await db.get(userCheckingQuery);
  if (userExistance !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (passwordCheck(password)) {
      await db.run(userPostingQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  }
});

//  2) POST API: /login/

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userCheckingQuery = `
    SELECT
    *
    FROM
    user
    WHERE username = "${username}";`;
  const usernameInTable = await db.get(userCheckingQuery);
  if (usernameInTable === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordVerify = await bcrypt.compare(
      password,
      usernameInTable.password
    );
    if (passwordVerify) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "akhil_code");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//  3) GET API: /user/tweets/feed/

app.get(
  "/user/tweets/feed/",
  jwtTokenAuthentication,
  async (request, response) => {
    let { username } = request;
    const findingUserId = `
    SELECT
    user_id
    FROM
    user
    WHERE username = "${username}";`;

    const userIDofuser = await db.get(findingUserId);
    let { user_id } = userIDofuser;
    const tweetQuery = `
      SELECT 
      username,tweet,date_time 
      FROM tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id INNER JOIN user ON follower.following_user_id = user.user_id 
      WHERE follower_user_id="${user_id}" 
      ORDER BY tweet.date_time DESC LIMIT 4;`;

    const tweetResponse = await db.all(tweetQuery);
    response.send(tweetResponse.map((n) => dateFormat(n)));
    console.log(user_id);
  }
);

//  4) GET API: /user/following/

app.get(
  "/user/following/",
  jwtTokenAuthentication,
  async (request, response) => {
    let { username } = request;
    const findingUserId = `
    SELECT
    user_id
    FROM
    user
    WHERE username = "${username}";`;
    const userIDofuser = await db.get(findingUserId);
    let { user_id } = userIDofuser;
    const followingQuery = `
    SELECT name from user INNER JOIN follower ON user.user_id = follower.following_user_id 
    WHERE follower_user_id =${user_id};`;

    const userFollowing = await db.all(followingQuery);
    response.send(userFollowing);
  }
);

//  5) GET API: /user/followers/

app.get(
  "/user/followers/",
  jwtTokenAuthentication,
  async (request, response) => {
    let { username } = request;
    const findingUserId = `
    SELECT
    user_id
    FROM
    user
    WHERE username = "${username}";`;
    const userIDofuser = await db.get(findingUserId);
    let { user_id } = userIDofuser;
    const followingQuery = `
    SELECT name from user INNER JOIN follower ON user.user_id = follower.follower_user_id 
    WHERE following_user_id =${user_id};`;

    const userFollowing = await db.all(followingQuery);
    response.send(userFollowing);
  }
);

//  6)  GET API : /tweets/:tweetId/

app.get(
  "/tweets/:tweetId/",
  jwtTokenAuthentication,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const findingUserId = `
    SELECT
    user_id
    FROM
    user
    WHERE username = "${username}";`;
    const userIDofuser = await db.get(findingUserId);
    let { user_id } = userIDofuser;
    const followingQuery = `
    select 
    tweet, count(like.tweet_id) as likes, count(reply.tweet_id) as replies, date_time
    from tweet left join follower on tweet.user_id = follower.following_user_id 
    left join like on like.tweet_id = tweet.tweet_id left join reply on reply.tweet_id = tweet.tweet_id
    where follower.follower_user_id = ${user_id} and tweet.tweet_id = ${tweetId};`;
    const userFollowing = await db.all(followingQuery);
    const { tweet } = userFollowing;
    if (userFollowing[0].tweet !== null) {
      response.send(userFollowing.map((f) => dateFormatTwo(f)));
    } else {
      response.send("Invalid Request");
      response.status(401);
    }
  }
);

//  7) GET API : /tweets/:tweetId/likes/

app.get(
  "/tweets/:tweetId/likes/",
  jwtTokenAuthentication,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const findingUserId = `
    SELECT
    user_id
    FROM
    user
    WHERE username = "${username}";`;
    const userIDofuser = await db.get(findingUserId);
    let { user_id } = userIDofuser;
    const followingQuery = `select username from tweet
    left join like on tweet.tweet_id = like.tweet_id left join user on 
    like.user_id = user.user_id left join follower on 
    tweet.user_id = follower.following_user_id
     where like.tweet_id = ${tweetId} and follower.follower_user_id = ${user_id};`;
    const userFollowing = await db.all(followingQuery);
    let resulting = { likes: userFollowing.map((v) => likesFormat(v)) };
    let likes = { resulting };
    if (userFollowing[0] === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(resulting);
    }
  }
);
