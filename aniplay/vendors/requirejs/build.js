( {
	baseUrl : '../../libs',
	paths : {
		requireLib : '../vendors/require',
		app : '../app',
		proxy : '../proxy'
	},
	include : ['requireLib'],
	name : 'app/main.wub',
	/*optimize : 'uglify',*/
	optimize : 'none',
	onBuildWrite: function (moduleName, path, contents) {
		// return contents;
		return contents.replace(/console.log(.*);/g, '');
		//return contents;
	},
	out : '../../../gen/aniplay-0.2.33.js'
})