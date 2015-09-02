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

gulp.task('watch', function() {
    gulp.watch(['src/sqlite.js'], ['build']);
    //gulp.watch(['src/sqlite.js'], function(files) {
    //    //runSequence('build', function(){
    //    //    console.log('build');
    //    //    done();
    //    //});
    //});

  //gulp.watch('./src/sqlite.js', ['build']);
});


gulp.task('default', ['watch', 'server']);