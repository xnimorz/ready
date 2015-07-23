var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

gulp.task('build', function() {
    return gulp.src('ready.js')
               .pipe(uglify())
               .pipe(rename(function(file) {
                   file.basename = 'ready.min';
                }))
               .pipe(gulp.dest('.'));
});