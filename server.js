/**
 * 🚀 Combined backend + frontend server for Neon Tetris (Cloudflare-ready)
 * Includes basic Gulp build tasks for deployment.
 * Run locally with: node server.js
 * Build for deploy with: npx gulp build
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

// ✅ MongoDB Connection
const uri = "mongodb+srv://sunwukong99733_db_user:j5AVYyxkTjvI8nU5@cluster0.xjjoqph.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri);
const dbName = "tetrisDB";
let db, users, leaderboard;

// --- Password hash helper ---
function hashPassword(pwd) {
  return crypto.createHash("sha256").update(pwd).digest("hex");
}

// --- Read JSON helper ---
async function getJSON(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch (e) { reject(e); }
    });
  });
}

// --- HTTP SERVER ---
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.end();

  // Serve built frontend from dist/
  const filePath = path.join(__dirname, "../dist", req.url === "/" ? "index.html" : req.url);
  if (fs.existsSync(filePath) && !req.url.startsWith("/api")) {
    const ext = path.extname(filePath);
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
    res.setHeader("Content-Type", types[ext] || "text/plain");
    return fs.createReadStream(filePath).pipe(res);
  }

  try {
    // --- REGISTER ---
    if (req.url === "/api/register" && req.method === "POST") {
      const { username, password } = await getJSON(req);
      if (!username || !password) throw new Error("Missing fields");
      const existing = await users.findOne({ username });
      if (existing) throw new Error("User already exists");
      await users.insertOne({ username, password: hashPassword(password), highScore: 0 });
      return res.end(JSON.stringify({ ok: true }));
    }

    // --- LOGIN ---
    if (req.url === "/api/login" && req.method === "POST") {
      const { username, password } = await getJSON(req);
      const user = await users.findOne({ username });
      if (!user || user.password !== hashPassword(password)) throw new Error("Invalid credentials");
      return res.end(JSON.stringify({ ok: true }));
    }

    // --- SAVE GAME ---
    if (req.url === "/api/save" && req.method === "POST") {
      const data = await getJSON(req);
      const { username, score } = data;
      await users.updateOne(
        { username },
        { $set: { saveData: data, highScore: Math.max(score || 0, 0) } }
      );
      await leaderboard.updateOne(
        { username },
        { $set: { username, highScore: score || 0 } },
        { upsert: true }
      );
      return res.end(JSON.stringify({ ok: true }));
    }

    // --- LOAD GAME ---
    if (req.url.startsWith("/api/load") && req.method === "GET") {
      const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const username = query.get("username");
      const user = await users.findOne({ username });
      return res.end(JSON.stringify({ ok: true, save: user?.saveData || null }));
    }

    // --- LEADERBOARD ---
    if (req.url === "/api/leaderboard" && req.method === "GET") {
      const data = await leaderboard.find().sort({ highScore: -1 }).limit(10).toArray();
      return res.end(JSON.stringify({ ok: true, top: data }));
    }

    // Default: not found
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Route not found" }));

  } catch (err) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
});

// --- Start MongoDB + Server ---
client.connect()
  .then(() => {
    db = client.db(dbName);
    users = db.collection("users");
    leaderboard = db.collection("leaderboard");
    server.listen(3000, () =>
      console.log("✅ Server running at http://localhost:3000")
    );
    console.log("✅ Connected to MongoDB");
  })
  .catch(err => console.error("❌ MongoDB connection failed:", err));

/* =======================================================================
   🧩 GULP TASKS FOR BUILDING FRONTEND
   - Copies frontend files into ../dist/
   - Minifies HTML, CSS, and JS for Cloudflare deployment
   ======================================================================= */

if (require.main === module) {
  try {
    const gulp = require("gulp");
    const clean = require("gulp-clean");
    const htmlmin = require("gulp-htmlmin");
    const cleanCSS = require("gulp-clean-css");
    const uglify = require("gulp-uglify");
    const concat = require("gulp-concat");

    const paths = {
      src: "../frontend/**/*",
      dist: "../dist",
    };

    gulp.task("clean", function () {
      return gulp.src(paths.dist, { allowEmpty: true, read: false }).pipe(clean());
    });

    gulp.task("html", function () {
      return gulp
        .src("../frontend/**/*.html")
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest(paths.dist));
    });

    gulp.task("css", function () {
      return gulp
        .src("../frontend/**/*.css")
        .pipe(cleanCSS())
        .pipe(concat("style.min.css"))
        .pipe(gulp.dest(paths.dist + "/css"));
    });

    gulp.task("js", function () {
      return gulp
        .src("../frontend/**/*.js")
        .pipe(uglify())
        .pipe(concat("app.min.js"))
        .pipe(gulp.dest(paths.dist + "/js"));
    });

    gulp.task("build", gulp.series("clean", "html", "css", "js", function (done) {
      console.log("✅ Frontend build complete. Ready for deployment.");
      done();
    }));

  } catch (err) {
    console.warn("⚠️ Gulp not installed — skipping build tasks.");
  }
}
