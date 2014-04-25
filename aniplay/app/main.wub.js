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
	}//,
	//urlArgs : "bust="+(new Date()).getTime()
});

var AniPlay;

(function() {

	require(
		['proxy/wub/AniPlay'],
		function(_AniPlay){

			if(typeof ComingBridge!='undefined' && 
				typeof ComingBridge.printLog =='function' &&
				typeof console == 'object'){
				console.log = ComingBridge.printLog;
				console.warn = ComingBridge.printLog;
			}

			AniPlay = _AniPlay;
			AniPlay.dom.dispatchEvent(window, 
				AniPlay.ANI_PLAY_READY, AniPlay, true, true);
			AniPlay.init();

			if(typeof animator_cfg === 'object'){

				//AniPlay.loadPlayModel(animator_cfg);
				//AniPlay.dom.addEvent(window, 'wubReady', function(){
				//	AniPlay.loadPlayModel(animator_cfg);
				//});

				if(typeof aniPlayIsIDE === 'undefined' || aniPlayIsIDE === false){
					var checkDom=null, checkDomCount=0;
					(function(){
						checkDom = setInterval(function(){
							if(AniPlay.loadPlayModel(animator_cfg)){
								clearInterval(checkDom);
								checkDom = null;
							}
							if(checkDom && checkDomCount > 20){
								clearInterval(checkDom);
								checkDom = null;
								console.warn('AniPlay.loadPlayModel(animator_cfg) failed');
							}
							checkDomCount++;
						},100);
						//for safe
						setTimeout(function(){
							clearInterval(checkDom);
							checkDom = null;
						}, 3000);
					})();
				}
			}

			/*
			document.addEventListener(
				AniPlay.ANI_GROUP_END, function(oEvent){
				console.log(oEvent.bundle);
			});
			document.addEventListener(
				AniPlay.ANI_GROUP_ITERATION, function(oEvent){
				console.log(oEvent.bundle);
			});
			document.addEventListener(
				AniPlay.ANI_GROUP_START, function(oEvent){
				console.log(oEvent.bundle);
			});

			document.addEventListener(
				AniPlay.ALL_ANI_GROUP_STOP, function(oEvent){
					console.log('ALL_ANI_GROUP_STOP');
			});

			AniPlay.dom.addEvent(document, 'keydown', function(oEvent){
				if(oEvent.keyCode==49){
					AniPlay.playCurrentPage();
				}else if(oEvent.keyCode==50){
					AniPlay.pauseCurrentPage();
				}else if(oEvent.keyCode==51){
					AniPlay.stopCurrentPage();

				}else if(oEvent.keyCode==52){
					AniPlay.playPageById('page1');
				}else if(oEvent.keyCode==53){
					AniPlay.pausePageById('page1');
				}else if(oEvent.keyCode==54){
					AniPlay.stopPageById('page1');

				}else if(oEvent.keyCode==55){
					AniPlay.playAniGroupsById('page1', ['anim1']);
				}else if(oEvent.keyCode==56){
					AniPlay.pauseAniGroupsById('page1', 'anim1');
				}else if(oEvent.keyCode==57){
					AniPlay.stopAniGroupsById('page1', ['anim2']);
					
				}else if(oEvent.keyCode==48){
					AniPlay.goToStartFrame();
				}
			});
			*/
		}
	);

})();