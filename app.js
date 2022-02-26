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
