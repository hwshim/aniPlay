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
define(function(require, exports, module) {

	var uid=0, timers={};

	module.exports = {
		getTimer : function(uid){
			return timers[uid];
		},
		repeat : function(p){
			var onRepeat = p.onRepeat || function(){},
				duration = p.duration || 1000,
				iteration = p.iteration || 1, 
				immediately = p.immediately || true, 
				onEnd = p.onEnd || function(){},
				bundle = p.bundle || {};
			var timer = timers[++uid] = {
				id : null,
				type : 'repeat',
				duration : duration,
				iteration : iteration,
				step : 0,
				paused : false,
				startMs : 0,
				progress : 0,
				bundle : bundle,
				onRepeat : onRepeat,
				onEnd : onEnd
			};
			if(immediately){
				++timer.step;
				timer.startMs = (new Date()).getTime();
				onRepeat(bundle);
			}
			timer['id'] = setInterval(function(bundle){
				if(++timer.step <= timer['iteration']){
					timer.startMs = (new Date()).getTime();
					onRepeat(bundle);
				}else{
					onEnd(bundle);
					clearInterval(timer['id']);
				}
			},timer['duration'],bundle);
			return uid;
		},
		setInterval : function(func, msec){
			timers[++uid] = {
				type : 'interval',
				id : setInterval(func, msec)
			};
			return uid;
		},
		setTimeout : function(func, msec){
			timers[++uid] = {
				type : 'interval',
				id : setTimeout(func, msec)
			};
			return uid;
		},
		pause : function(u){
			var timer = timers[u],
				type = timer['type'];
			switch(type){
				case 'interval' :
					//TODO
					break;
				case 'timeout' :
					//TODO
					break;
				case 'repeat' :
					var elapsed = (new Date()).getTime()-timer['startMs'];
					timer['progress'] = elapsed/timer['duration'];
					timer['paused'] = true;
					clearInterval(timer['id']);
					clearInterval(timer['timeout']);
					break;
			}
		},
		resume : function(u, callback){
			var timer = timers[u],
				type = timer['type'];
			switch(type){
				case 'interval' :
					//TODO
					break;
				case 'timeout' :
					//TODO
					break;
				case 'repeat' :
					timer.paused = false;
					console.log(timer);

					//남은 시간동안 진행한다

					callback();

					++timer.step;

					var ms = (1-timer['progress'])*timer['duration'];

					timer['timeout'] = setTimeout(function(timer){
						
						var onRepeat = timer.onRepeat;
						var onEnd = timer.onEnd;
						var bundle = timer.bundle;

						timer.startMs = (new Date()).getTime();
						onRepeat(bundle);

						timer['id'] = setInterval(function(bundle){
							if(++timer.step <= timer['iteration']){
								timer.startMs = (new Date()).getTime();
								onRepeat(bundle);
							}else{
								onEnd(bundle);
								clearInterval(timer['id']);
							}
						},timer['duration'],bundle);

					},ms,timer);

					break;
			}
		},
		clear : function(u){
			var timer = timers[u],
				type = timer['type'];
			switch(type){
				case 'interval' :
					clearInterval(timer['id']);
					break;
				case 'timeout' :
					clearTimeout(timer['id']);
					break;
				case 'repeat' :
					clearInterval(timer['id']);
					break;
			}
		},
		sleep : function(delay) {
			var start = new Date().getTime();
			while (new Date().getTime() < start + delay);
		}
	};
});