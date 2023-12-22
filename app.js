const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

let db = null;

const dbPath = path.join(__dirname, "twitterClone.db");

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.og(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const selectUserQuery = `
    SELECT * FROM user
    WHERE username='${username}';`;

  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = bcrypt.hash(request.body.password, 10);
      const createUserQuery = `
    INSERT INTO user(username, password, name, gender)
    VALUES(
        '${username}',
        '${hashedPassword}',
        '${name}',
        '${gender}'
    );`;

      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `
  SELECT * FROM user
  WHERE username='${username}';`;

  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
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
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `
  SELECT user.username, tweet.tweet, tweet.date_time AS dateTime FROM follower INNER JOIN tweet
  ON follower.following_user_id = tweet.user_id
  INNER JOIN user
  ON tweet.user_id = user.user_id
  WHERE user.username = '${username}'
  ORDER BY date_time DESC
  LIMIT 4;`;

  const dbUser = await db.all(getUserQuery);
  response.send(dbUser);
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getFollowingIds = `
    SELECT follower.following_user_id
FROM user
JOIN follower ON user.user_id = follower.follower_user_id
WHERE user.username = '${username}';`;

  const dbUser = await db.all(getFollowingIds);

  const getFollowingUser = `
  SELECT name
  FROM user
  WHERE user_id = ${dbUser[0].following_user_id}
  OR user_id = ${dbUser[1].following_user_id}`;

  response.send(await db.all(getFollowingUser));
});

module.exports = app;
