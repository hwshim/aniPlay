var animator_cfg = {
  "scenes": [
    {
      "id": "page1",
      "show": true,
      "transit": "none",
      "events": {
      	/*
      	"pageshow" : [
			{
				"id" : "event1", 
				"type" : "AniGroup",
				"target" : "anim1",
				"act" : "play"
			}
		]
		*/
      },
      "layers": [
        {
          "id": "layer1",
          "shapes": [
            {
              "id": "header1",
              "type": "Header"
            },
            {
              "id": "content1",
              "type": "Content",
              "children": [
                {
                  "id": "circle1",
                  "type": "",
                  "events": {
                  	"click" : [
						{
							"id" : "event2",
							"type" : "AniGroup",
							"target" : "anim1",
							"act" : "pause"
						},
						{
							"id" : "event3",
							"type" : "AniGroup",
							"target" : "anim2",
							"act" : "play"
						}
                  	]
                  }
                },
                {
                  "id": "image1",
                  "type": "Image"
                }
              ]
            }
          ]
        }
      ],
      "aniGroups": [
        {
          "id": "anim1",
          "members": [
            {
              "id": "circle1",
              "selector": "#circle1",
              "visibility": true,
              "animation": {
              	"id" : "aniCircle1",
                "delay": "0s",
                "duration": "1s",
                "iteration": 1,
                "timing": "linear",
                "justplay": true,
                "holdEnd": true,
                "keyframe": []
              }
            },
            {
              "id": "image1",
              "selector": "#image1",
              "visibility": true,
              "animation": {
              	"id" : "aniImage1",
                "delay": "1s",
                "duration": "1s",
                "iteration": 1,
                "timing": "linear",
                "justplay": true,
                "holdEnd": true,
                "keyframe": []
              }
            }
          ],
          "duration": "2s",
          "iteration": 1,
          "justplay": true,
          "holdEnd": true
        }
      ]
    },
    {
      "id": "page2",
      "show": false,
      "transit": "none",
      "events": {
      	/*
      	"pageshow" : [
			{
				"id" : "event1", 
				"type" : "AniGroup",
				"target" : "anim1",
				"act" : "play"
			}
		]
		*/
      },
      "layers": [
        {
          "id": "layer2",
          "shapes": [
            {
              "id": "header2",
              "type": "Header"
            },
            {
              "id": "content2",
              "type": "Content",
              "children": [
                {
                  "id": "shape2",
                  "type": "Content",
             	  "children": [
             	    {
	                  "id": "image2",
	                  "type": "Image"
	                }
             	  ]
                }
              ]
            }
          ]
        }
      ],
      "aniGroups": [
        {
          "id": "anim2",
          "members": [
            {
              "id": "shape2",
              "selector": "#shape2",
              "visibility": true,
              "animation": {
              	"id" : "aniShape2",
                "delay": "0s",
                "duration": "5s",
                "iteration": 1,
                "timing": "linear",
                "justplay": true,
                "holdEnd": true,
                "keyframe": []
              }
            },
            {
              "id": "image2",
              "selector": "#image2",
              "visibility": true,
              "animation": {
              	"id" : "aniImage2",
                "delay": "0s",
                "duration": "1s",
                "iteration": 5,
                "timing": "linear",
                "justplay": true,
                "holdEnd": true,
                "keyframe": []
              }
            }
          ],
          "duration": "5s",
          "iteration": 'infinite',
          "justplay": true,
          "holdEnd": true
        }
      ]
    }
  ]
};