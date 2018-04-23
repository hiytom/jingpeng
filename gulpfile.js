/*
 	author：amaoliu刘彦龙
 	date:2017.04.17
 	这次项目重构,我是把h5,web,pc等项目作为一个工程来处理的,所以只有一份gulp文件,如果每个项目都对应一个gulp文件,那只要改动一个gulp,其他的都需要改动,感觉不太对.
 	正因为如此,所以css地址或者提单文件地址会多出一个项目名称,如h5或者web,导致路径不太优雅.
 */

//配置文件
var config = {
	"dev_ip": "10.123.9.9:8997",
	"dev_url": "/usr/local/imgcache/htdocs", //部署必须的路径前缀
	"dev_path": "/tencentvideo/vstyle/newvip/style",
	"dev_inc": "/data/web/film.qq.com/inc",//部署html文件(icon等公共页面片提供给前端用)
}

//引入的插件
var gulp = require('gulp'); //引入gulp
fs = require('fs'); //文件流操作
util = require('util'); //格式format
vdeploy = require('vfe-deploy'); //部署到9.9  用法参考https://www.npmjs.com/package/vfe-deploy
os = require('os'); //用来获取计算机的一些信息
args = require('process.args')(); //监听在命令行输入的参数
runSequence = require('run-sequence'); //把任务串行
del = require('del'); //删除文件

gutil = require('gulp-util'); //format一些参数
uglify = require('gulp-uglify'); //压缩js的插件
watchPath = require('gulp-watch-path'); //检测路径
sass = require('gulp-sass'); //编译sass
cleancss = require('gulp-clean-css'); //gulp-minify-css的新版,压缩css文件,并给引用url添加版本号避免缓存
fileinclude = require('gulp-file-include'); //用来合并html
clean = require('gulp-clean'); //清除dist目录
svgSymbols = require('gulp-svg-symbols'); //输出svg雪碧图
connect = require('gulp-connect'); //启动服务器
plumber = require('gulp-plumber');
notify = require('gulp-notify');
insert = require('gulp-insert'); //在pipe插入指定内容
spritesmith = require('gulp.spritesmith'); //合并雪碧图
sourcemaps = require('gulp-sourcemaps'); //生成sourcemap
browserSync = require('browser-sync').create();
reload = browserSync.reload;
// base64 = require('gulp-base64'); //小图片转化为base64

//定义的变量
var pwd = process.env.PWD || process.cwd(); //当前路径
var path = {
	src: pwd + '/src/', //编译前存放目录
	dist: pwd + '/style/', //编译后的文件存放在根目录,现在是为了方便cssgaga,其实我觉得应该是放在/s/里面
	cssmin: pwd + '/style/cssmin/',
	toolSrc: pwd + '/tools/input/', //工具编译前存放路径
	toolDist: pwd + '/tools/output/' //工具编译后存放路径
}
var components = ['html', 'css', 'imgs', 'js', 'font', 'animate']; //前端组件
var platform = ['web', 'h5', 'pc', 'ipad'];

var username = os.hostname().replace(/-.*/, '').toLowerCase(); //获取当前用户名称
var deployPath = config.dev_url + config.dev_path; //提单路径


//编译sass和js，编译到style目录下，用于gulp build确保style的存在
platform.forEach(function (y) {
	//编译sass
	gulp.task(util.format('css:%s', y), () => {
		return gulp.src([util.format(path.src + '%s/css/**/*.scss', y), util.format(path.src + '!%s/css/@*/*.scss', y), util.format(path.src + '!%s/@*/**/*.scss', y)])
			.pipe(sourcemaps.init())
			.pipe(sass().on('error', sass.logError))
			.pipe(sourcemaps.write())
			.pipe(insert.append('\n#' + username + '{content:"' + getTime() + '"}')) //给文件打上时间戳
			.pipe(gulp.dest(util.format(path.dist + '%s/css', y)));
	});

	//编译js
	gulp.task(util.format('js:%s', y), () => {
		gulp.src(util.format(path.src + '%s/js/**/*.js', y))
			.pipe(uglify())
			.pipe(gulp.dest(util.format(path.dist + '%s/js', y)));
	});

	//合并html公共模块
	gulp.task(util.format('htmlinclude:%s', y), () => {
		gulp.src(util.format(path.src + '%s/html/**/*.html', y))
			.pipe(fileinclude({
				prefix: '@@',
				basepath: '@file'
			}))
			.pipe(insert.append('\n<!--author: ' + username + ', date: ' + getTime() + '-->'))
			.pipe(gulp.dest(util.format(path.dist + '%s/html', y)));
	});

	//图片处理
	gulp.task(util.format('imgs:%s', y), () => {
		gulp.src(util.format(path.src + '%s/imgs/**', y))
			.pipe(gulp.dest(util.format(path.dist + '%s/imgs', y)));
	})

	gulp.task(util.format('font:%s', y), () => {
		gulp.src(util.format(path.src + '%s/font/**', y))
			.pipe(gulp.dest(util.format(path.dist + '%s/font', y)));
	})

	gulp.task(util.format('animate:%s', y), () => {
		gulp.src(util.format(path.src + '%s/animate/**', y))
			.pipe(gulp.dest(util.format(path.dist + '%s/animate', y)));
	})
})


gulp.task('build', () => {
	runSequence('init', 'cssmin');
})

gulp.task('init', components);
components.forEach(function (co) {
	gulp.task(co, getPlatform(co));
})

gulp.task('cssmin', () => {
	gulp.src(path.dist + '*/css/**/*.css')
		.pipe(cleancss({ rebase: false }))
		.pipe(gulp.dest(path.cssmin));
})

/**
 * 这个方法还有待改善,应该是监听到dist文件有改动,才调用这个cssmin,但是sass()会改变所有的dist目录,所以只有暂时先个task方法
 */
platform.forEach(function (pl) {
	gulp.task('watchCss:' + pl, function () {
		runSequence('css:' + pl, 'cssmin');
	})
})


//监听文件
gulp.task('dev', ['watchFiles', 'webserver']);

//监听文件
gulp.task('watchFiles', () => {
	platform.forEach(function (e) {
		gulp.watch(util.format('src/%s/css/**/*.scss', e), ['watchCss:' + e]).on('change', function (event) {
			showFileChange(event);
			reload;
		})
		gulp.watch(util.format('src/%s/html/**', e), ['htmlinclude:' + e]).on('change', function (event) {
			showFileChange(event);
		});
		gulp.watch(util.format('src/%s/js/**', e), ['js:' + e]).on('change', function (event) {
			showFileChange(event);
		});
		gulp.watch(util.format('src/%s/imgs/**', e), ['imgs:' + e]).on('change', function (event) {
			showFileChange(event);
		});
	})
	console.log("start watching...")
})

//启动本地服务器
gulp.task('webserver', () => {
	// connect.server({
	// 	root: 'style',
	// 	port: 8888
	// });
	browserSync.init({
		server: {
			baseDir: path.dist
		},
		notify: false,
		directory: true,
		port: '8887',
		open: 'external'
	})
})


//输出svg雪碧图
gulp.task('svg', () => {
	gulp.src(util.format(path.src + '%s/imgs/**/*.svg', y))
		.pipe(svgSymbols())
		.pipe(gulp.dest(path.dist));
})

//输出png的雪碧图
gulp.task('sprite', () => {
	var spriteData = gulp.src(path.toolSrc + 'sprites/*.png')
		.pipe(spritesmith({
			imgName: 'sprite.png',
			cssName: 'sprite.css',
			cssFormat: 'css',
		}));
	return spriteData.pipe(gulp.dest(path.toolDist));
})

//输出png的雪碧图2x 这里需要放一个2倍图才能做出2x的雪碧图
gulp.task('sprite2x', () => {
	var spriteData = gulp.src(path.toolSrc + 'sprites/*.png')
		.pipe(spritesmith({
			retinaSrcFilter: path.toolSrc + 'sprites/*@2x.png',
			imgName: 'sprite.png',
			retinaImgName: 'sprite@2x.png',
			cssName: 'sprite.css',
		}));
	return spriteData.pipe(gulp.dest(path.toolDist));
})

//清除dist目录
gulp.task('clean', () => {
	return gulp.src(path.dist, {
		read: false
	})
		.pipe(clean());
})

//同步代码到9.9
/**
 * _platform:输入的参数 等号左边
 * _pl:表示平台(h5/web/pc);
 * _co:组件(css/js/html);
 */
gulp.task('push', function () {
	var _platform = args.push;
	var _pl;
	var _co;

	var files = [];
	var toLogFilesName = []; //需要打印出来的文件名
	var toDepolyFiles = []; //vdeploy的第一个参数如果是string的话 会报错,所以只有用数组了.
	var errorMsg;
	var enterPath; //输入的路径地址

	platform.forEach(function (x) {
		components.forEach(function (y) {
			var _args = _platform[x + '/' + y];
			if (_args) {
				_pl = x;
				_co = y;
				enterPath = _args;
			} else {
				errorMsg = "输入的平台或者组件错误";
			}
		})
	})

	if (enterPath != undefined) {
		var paths = enterPath.split(',');
		return gulp.src(paths.map(function (item) {
			var min_url = _pl + "/" + _co + "/";
			var typeArr = item.split(".");
			var File = new file();
			File.name = item;
			File.type = typeArr[typeArr.length - 1];
			File.srcPath = path.src + min_url + item.replace('.css', ".scss");
			File.distPath = File.type == "css" ? path.cssmin + min_url + item : path.dist + min_url + item;
			files.push(File);
			toDepolyFiles.push(File.distPath);
			toLogFilesName.push("/" + min_url + File.name);
			return " ";
		}), {
				base: path.dist //其实我自己也不知道这个base到底有什么用,感觉可以不用
			})
			.pipe(plumber({
				errorHandler: notify.onError("Error: <%= error.message %>") //这个说实话我也不知道有什么用
			}))
			.on('error', function (error) {
				console.log(error);
				this.emit('end');
			})
			.on('end', function () {
				files.forEach(function (file) {
					if (file.type == 'css') {
						var imgs = deployImgUrl(_pl, file.distPath);
						imgs.forEach(function (item) {
							toLogFilesName.push(item);
						})
						deployFiles(toDepolyFiles, path.cssmin, config.dev_path);
					} else if (file.type == 'html') {
						//这里是对h5的svgIcon做一个单独处理
						if (file.name.indexOf('h5_svgicon') > 0) {
							deployIncFiles(toDepolyFiles, path.dist, config.dev_inc);
							console.log("提单文件:")
							console.log("/data/web/film.qq.com/inc/h5_svgicon.html");
						} else {
							deployFiles(toDepolyFiles, path.dist, config.dev_path);
						}
					}
					else {
						deployFiles(toDepolyFiles, path.dist, config.dev_path);
					}
				})
				printLog(toLogFilesName);
			})

	} else if (enterPath == undefined) {
		console.log("输入的路径有错误.");
		console.log(errorMsg);
	} else {
		console.log("输入路径格式错误.");
		console.log("输入的路径是:" + enterPath);
	}
})



//一些自定义方法
/**
 * 上传文件 https://www.npmjs.com/package/vfe-deploy
 * @param {Array} files 文档里说string和array都行,但是string会报错,不知道什么原因.不过string是可以上传文件的
 * @param {String} basePath 
 * @param {String} path 服务器上的路径
 */
function deployFiles(files, basePath, path) {
	// proxy: false， 
	// 超过1M文件会上传失败，需要禁用代理（vdeploy作者说的
	vdeploy({
		src: files,
		base: basePath,
		host: config.dev_ip,
		path: config.dev_url + path,
		proxy: false
	}, function (err) {
		err && console.error('部署出错', err);
	})
}
/**
 * 上传页面片的特殊部署方法
 * @param {*} files 
 * @param {*} basePath 
 * @param {*} path 
 */
function deployIncFiles(files, basePath, path) {
	// proxy: false， 
	// 超过1M文件会上传失败，需要禁用代理（vdeploy作者说的
	vdeploy({
		src: files,
		base: basePath + "h5/html/common/",
		host: config.dev_ip,
		path: path,
		proxy: false
	}, function (err) {
		err && console.error('部署出错', err);
	})
}

/**
 * 输出提单地址
 * @param  {[type]} filesName [description]
 * @return {[type]}           [description]
 */
function printLog(filesName) {
	var path1 = ""; //9.9地址
	var path2 = ""; //提单地址
	if (filesName) {
		filesName.forEach(function (item) {
			if (item.indexOf("h5_svgicon") < 0) {
				path1 += "http://10.123.9.9" + config.dev_path + item + '\n';
				path2 += config.dev_url + config.dev_path + item + '\n';
			} else {
				path1 += "";
				path2 += "/data/web/film.qq.com/inc/h5_svgicon.html";
			}
		})
		console.log("9.9文件地址:")
		console.log(path1);
		console.log("提单文件:")
		console.log(path2);
	}
}


var pad2 = function (n) {
	return n < 10 ? '0' + n : n
}

//获取本地时间
function getTime() {
	var now = new Date();
	return timestamp = now.getFullYear().toString() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds());
}


// 替换css里面的图片路径
/**
 * 把css里面引用的图片同步到9.9
 * @param  {[type]} platform [平台]
 * @param  {[type]} cssFile  [css文件]
 * @return 返回提单文件名 以便printlog
 */
function deployImgUrl(platform, cssFile) {
	var imgsName = []; //返回的文件名
	var deploy_files = []; //需要同步到9.9的文件
	var fileData = fs.readFileSync(cssFile, "utf-8");
	var result = fileData.match(/(\/imgs[^)]*)/g);
	if (result) {
		result.forEach(function (item) {
			deploy_files.push(path.dist + platform + item);
			imgsName.push("/" + platform + item);
		});
		deployFiles(deploy_files, path.dist, config.dev_path);
	}
	return imgsName;
}

//需要上传的文件
function file(name, type, srcPath, distPath) {
	this.name = name;
	this.type = type;
	this.srcPath = srcPath;
	this.distPath = distPath;
}

/**
 * 遍历出gulp.task方法
 * @param {array} co 组件
 */
function getPlatform(co) {
	if (co == "html") {
		co = 'htmlinclude';
	}
	var pl = []
	platform.forEach(function (item) {
		pl.push(co + ':' + item);
	})
	return pl;
}

/**
 * 监听删除文件操作
 * @param {object} event 
 */
function showFileChange(event) {
	console.log(event.type);
	console.log(event.path);
	if (event.type == 'deleted') {
		var delFile = event.path.replace(path.src, path.dist);
		if (delFile.indexOf('.scss') > -1) {
			delFile = delFile.replace('.scss', '.css');
		}
		del.sync(delFile);
	}
}