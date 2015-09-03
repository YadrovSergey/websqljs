var gulp = require('gulp'),
    $ = require('gulp-load-plugins')();

gulp.task('build', function() {
    console.log('--build');
  return gulp.src('./src/sqlite.js')
    .pipe($.plumber())
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.umd({
      dependencies: function(file) {
        return [
          {
            name: 'lodash',
            amd: 'lodash',
            cjs: 'lodash',
            global: 'lodash',
            param: 'lodash'
          }
        ]
      },
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

gulp.task('server', function() {
  gulp.src('./')
    .pipe($.webserver({
      port: 8095,
      livereload: true,
      directoryListing: true
    }));
});


gulp.task('copy-to-cordova', function() {
    gulp.src('./vendor/jquery/dist/jquery.min.js')
        .pipe(gulp.dest('./cordova/www/jquery.min.js'));

    gulp.src('./vendor/jasmine-core/lib/jasmine-core/jasmine.js')
        .pipe(gulp.dest('./cordova/www/jasmine.js'));

    gulp.src('./vendor/jasmine-core/lib/jasmine-core/jasmine-html.js')
        .pipe(gulp.dest('./cordova/www/jasmine-html.js'));

    gulp.src('./vendor/jasmine-core/lib/jasmine-core/boot.js')
        .pipe(gulp.dest('./cordova/www/boot.js'));

    gulp.src('./vendor/lodash/lodash.min.js')
        .pipe(gulp.dest('./cordova/www/lodash.min.js'));

    gulp.src('./lib/sqlite.js')
        .pipe(gulp.dest('./cordova/www/sqlite.js'));

    gulp.src('./spec/test.js')
        .pipe(gulp.dest('./cordova/www/test.js'));

    gulp.src('./vendor/jasmine-core/lib/jasmine-core/jasmine.css')
        .pipe(gulp.dest('./cordova/www/jasmine.css'));
});

gulp.task('watch', function() {
    gulp.watch(['src/sqlite.js'], ['build']);
});


gulp.task('default', ['watch', 'server']);