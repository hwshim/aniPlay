/****************************************************************************
 Copyright (c) 2014 Peter, H

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

"use strict";
requirejs.config({
	//By default load any module IDs from
	baseUrl : 'aniplay/libs',
	//except, if the module ID starts with "app",
	//load it from the js/app directory. paths
	//config is relative to the baseUrl, and
	//never includes a ".js" extension since
	//the paths config could be for a directory.
	paths : {
		app : '../app',
		proxy : '../proxy'
	},
	urlArgs : "bust="+(new Date()).getTime()
});

var AniPlay;

(function() {

	require(
		['proxy/wub/AniPlay'],
		function(_AniPlay){
			AniPlay = _AniPlay;
		}
	);

	document.addEventListener('keydown', function(oEvent){
		if(oEvent.keyCode==49){
			AniPlay.log(1);
		}else if(oEvent.keyCode==50){
			AniPlay.log(2);
		}
	});

	setTimeout(function(){
		
		// animator_cfg : whatever name U want
		AniPlay.loadPlayModel(animator_cfg);

		//AniPlay.playGroups('page1', 'Anim1');
		
		//AniPlay.playGroups('page1', ['Anim1', 'Anim2']);
		
		AniPlay.playPage('page1');

	}, 1000);

})();