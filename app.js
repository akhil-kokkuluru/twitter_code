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

const repliesFormat = (replies) => {
  let replyReturn = { name: replies.name, reply: replies.reply };
  return replyReturn;
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
    const replyCountQuery = `
    select count(reply) as replies from reply where tweet_id = ${tweetId};`;

    const tweetQuery = `
    select count(like_id) as likes, tweet , date_time from tweet left join like on 
    tweet.tweet_id = like.tweet_id where tweet.tweet_id = ${tweetId} `;
    const follwingCheckQuery = `
    select tweet_id from tweet inner join follower 
    on tweet.user_id = follower.following_user_id where 
    follower_user_id = ${user_id};`;
    const checking = await db.all(follwingCheckQuery);
    const replyCount = await db.all(replyCountQuery);
    const tweetLikes = await db.all(tweetQuery);
    const [{ replies }] = replyCount;

    const responseObject = (arg, args) => {
      const returnObj = {
        tweet: arg[0].tweet,
        likes: arg[0].likes,
        replies: args,
        dateTime: arg[0].date_time,
      };

      return returnObj;
    };
    let g = responseObject(tweetLikes, replies);
    let crossCheck = checking.map((r) => r.tweet_id);
    let number = parseInt(tweetId);
    if (crossCheck.some((g) => g === number)) {
      response.send(g);
    } else {
      response.status(401);
      response.send("Invalid Request");
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

//  8) GET API : /tweets/:tweetId/replies/

app.get(
  "/tweets/:tweetId/replies/",
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
    const followingQuery = `select reply, name, tweet from reply
    left join user on 
    reply.user_id = user.user_id left join tweet on user.user_id = tweet.user_id
     where reply.tweet_id = ${tweetId} and reply.tweet_id in 
     (select tweet_id from tweet left join follower on
        tweet.user_id = follower.following_user_id where 
        follower.follower_user_id = ${user_id}) group by reply order by date_time desc;`;
    const userFollowing = await db.all(followingQuery);
    let replies = userFollowing.map((u) => repliesFormat(u));
    if (userFollowing[0] === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send({ replies });
    }
  }
);

//  9)  GET API : /user/tweets/

app.get("/user/tweets/", jwtTokenAuthentication, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  const findingUserId = `
    SELECT
    user_id
    FROM
    user
    WHERE username = "${username}";`;
  let tweetID;
  const userIDofuser = await db.get(findingUserId);
  let { user_id } = userIDofuser;

  const tweetDateQuery = `
  select tweet,date_time as dateTime, tweet_id from tweet where user_id = ${user_id};`;
  const finalResp = await db.all(tweetDateQuery);

  let newA = [];
  for (let x of finalResp) {
    const likeQ = `
    select count(like_id) as likes from like where tweet_id = ${x.tweet_id};`;
    let { likes } = await db.get(likeQ);
    x.likes = likes;
    newA.push(x);
  }
  for (let xg of finalResp) {
    const likeQ = `
    select count(reply) as replies from reply where tweet_id = ${xg.tweet_id};`;
    let { replies } = await db.get(likeQ);
    xg.replies = replies;
    newA.push(xg);
  }

  let theFINALS = [];

  for (let ak of finalResp) {
    let g = {
      tweet: ak.tweet,
      likes: ak.likes,
      replies: ak.replies,
      dateTime: ak.dateTime,
    };
    theFINALS.push(g);
  }

  response.send(theFINALS);
});

// 10 POST API : /user/tweets/

app.post("/user/tweets/", jwtTokenAuthentication, async (request, response) => {
  const { tweet } = request.body;
  let { username } = request;
  console.log(username);
  const findingUserId = `
      SELECT
      user_id
      FROM
      user
      WHERE username = "${username}";`;
  const userIDofuser = await db.get(findingUserId);
  let { user_id } = userIDofuser;

  const tweetPostQuery = `
    insert into
    tweet(tweet, user_id)
    values('${tweet}', ${user_id});`;

  await db.run(tweetPostQuery);
  response.send("Created a Tweet");
});

//  11 DELETE API : /tweets/:tweetId/

app.delete(
  "/tweets/:tweetId/",
  jwtTokenAuthentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const { tweet } = request.body;
    let { username } = request;
    const findingUserId = `
      SELECT
      user_id
      FROM
      user
      WHERE username = "${username}";`;
    const userIDofuser = await db.get(findingUserId);
    let { user_id } = userIDofuser;

    const tweetDeleteQuery = `
    delete from tweet where tweet_id = ${tweetId} and 
    user_id = ${user_id}`;
    const tweetSearch = `
    select tweet from tweet where user_id = ${user_id} and
     tweet_id = ${tweetId};`;

    const tweetSearching = await db.all(tweetSearch);
    if (tweetSearching[0] === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deletion = await db.run(tweetDeleteQuery);
      response.send("Tweet Removed");
    }
  }
);
