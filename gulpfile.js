var gulp = require('gulp'),
    $ = require('gulp-load-plugins')();

gulp.task('build', function() {
  return gulp.src('./src/sqllite.js')
    .pipe($.plumber())
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.umd({
      exports: function(file) {
        return 'sqlitejs';
      },
      namespace: function(file) {
        return 'sqlitejs';
      }
    }))
    .pipe(gulp.dest('./lib'))
    .pipe($.uglify())
    .pipe($.rename({ suffix: '.min' }))
    .pipe(gulp.dest('./lib'));
});

gulp.task('serve', function() {
  gulp.src('./')
    .pipe($.webserver({
      livereload: true,
      directoryListing: true
    }));
});

gulp.task('watch', function() {
  gulp.watch('./src/sqllite.js', ['build']);
});

gulp.task('default', ['build', 'watch', 'serve']);