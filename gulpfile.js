var gulp = require('gulp'),
    $ = require('gulp-load-plugins')();

gulp.task('build', function() {
  return gulp.src('./src/sqlite.js')
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

gulp.task('watch', ['test-jasmine'], function() {
  gulp.watch('./src/sqlite.js', ['test-jasmine']);
});

gulp.task('test-jasmine', ['build'], function() {
  return gulp.src('./spec/test.js')
    .pipe($.jasminePhantom({
      keepRunner: true,
      vendor: ['lib/sqlite.js'],
      integration: true
    }));
});

gulp.task('default', ['watch', 'serve']);