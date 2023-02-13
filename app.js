const express = require("express");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
let db = null;

const initializeDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDB();
//API 1 //
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (password.length > 5) {
    if (dbUser === undefined) {
      const createUserQuery = `INSERT INTO user (username, password, name, gender)
            VALUES ('${username}', '${hashedPassword}', '${name}', '${gender}');`;
      await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("User already exists");
    }
  } else {
    response.status(400);
    response.send("Password is too short");
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My_Secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 2 //
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "My_Secret");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3 //
app.get("/user/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getTweets = `SELECT user.username, tweet, date_time FROM tweet JOIN user
    ON tweet.user_id = user.user_id;`;
  const tweets = await db.all(getTweets);
  response.send(tweets);
});

//API 4 //
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserId = `SELECT * FROM user WHERE username = '${username}';`;
  const userId = await db.get(getUserId);
  const getFeedQuery = `SELECT user.username, tweet, date_time AS dateTime FROM tweet NATURAL JOIN
    user ORDER BY CAST(strftime('%d', date_time) AS INT) DESC LIMIT 4;`;
  const feedArray = await db.all(getFeedQuery);
  response.send(feedArray);
});

//API 5 //
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getNamesQuery = `
    SELECT name FROM user INNER JOIN follower ON user.user_id = follower.following_user_id WHERE
    user.username = '${username}';`;
  const dbNames = await db.all(getNamesQuery);
  response.send(dbNames);
});

app.get("/user/followers", authenticateToken, async (request, response) => {
  const { username } = request;
  const getFollowersQuery = `SELECT name from user INNER JOIN follower ON user.user_id
    = follower.follower_user_id WHERE user.username = '${username}';`;
  const dbUser = await db.all(getFollowersQuery);
  response.send(dbUser);
});
