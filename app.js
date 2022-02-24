const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
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

app.get("/", async (request, response) => {
  const check = `
    SELECT
    *
    FROM
    user;`;
  const forstresponse = await db.get(check);
  response.send(forstresponse);
});
console.log("akhil");
