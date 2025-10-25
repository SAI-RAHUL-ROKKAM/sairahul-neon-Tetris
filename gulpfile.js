// 🧠 Gulp build file for Tetris — frontend and backend in same folder
const gulp = require("gulp");
const clean = require("gulp-clean");
const htmlmin = require("gulp-htmlmin");
const cleanCSS = require("gulp-clean-css");
const uglify = require("gulp-uglify");
const concat = require("gulp-concat");

// since frontend files are in the SAME folder as backend
const paths = {
  src: "./",           // current folder
  dist: "./dist",      // build output
};

// 🧹 Clean dist folder
gulp.task("clean", function () {
  return gulp.src(paths.dist, { allowEmpty: true, read: false }).pipe(clean());
});

// 📦 Copy & minify HTML
gulp.task("html", function () {
  return gulp
    .src(["./*.html"])
    .pipe(htmlmin({ collapseWhitespace: true }))
    .pipe(gulp.dest(paths.dist));
});

// 🎨 Minify & copy CSS
gulp.task("css", function () {
  return gulp
    .src(["./*.css"])
    .pipe(cleanCSS())
    .pipe(concat("style.min.css"))
    .pipe(gulp.dest(paths.dist + "/css"));
});

// ⚙️ Minify & copy JS
gulp.task("js", function () {
  return gulp
    .src(["./*.js"])
    .pipe(uglify())
    .pipe(concat("app.min.js"))
    .pipe(gulp.dest(paths.dist + "/js"));
});

// 🚀 Main build task
gulp.task("build", gulp.series("clean", "html", "css", "js", function (done) {
  console.log("✅ Frontend build complete. Files in ./dist/");
  done();
}));
