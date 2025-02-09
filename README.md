# Home Tab Bookmark

Selfhosted SpeedDial style bookmark for browser home tab.

![screenshot](https://github.com/user-attachments/assets/d0d78c2d-e515-400e-a815-a646bf230b3e)

## Requirements
### Environment
* Node.js 18
### Browser
* Microsoft Edge
* Chrome
* Firefox

## Features
* Add groups.
* Right click on group name to edit / remove group.
* Drag and drop group to change the order of the group.
* Add bookmark in each group.
* Right click on bookmark to edit / remove bookmark.
* Press Shift key to force bookmark open in new tab.
* Automatically grab website favicon from input url for bookmark thumbnail.
* Reload bookmark thumbnail options through screenshot or favicon of the website. (define screenshot api with environment variable SCREENSHOT_API)
* Drag and drop bookmark to change the position of the bookmark.
* Drag and drop bookmark to move to another group (with bookmark's top left corner pointing to group name).
* Bookmark data store in browser's local storage.
* Import Data to (browser's local storage).
* Expprt Data from (browser's local storage).
* Backup Data (to container).
* Restore Data (from container).

## How to
* Clone this repository.
* Run *npm run dockerbuild* in terminal.
* Run *npm run dockersave* in terminal.
* Use image *home-tab-bookmark.tar* to create container.
* Install browser extension [New Tab Redirect](https://chromewebstore.google.com/detail/new-tab-redirect/icpgjfneehieebagbmdbhnlpiopdcmna?hl=en-US) and set new tab redirect to http://HOSTNAME:3000.

## ENV Variables
### SCREENSHOT_API ###
Bookmark thumbnail will use faviocn by default. Specific the screenshot api gives the option to use website screenshot as bookmark thumbnail. The screenshot api should be full api url without bookmark's url and it should return a png image.

Here is an example of screenshot api from [elestio/ws-screenshot.slim](https://hub.docker.com/r/elestio/ws-screenshot.slim) docker

http://[IP_ADDRESS]]:[PORT]/api/screenshot?resX=1024&resY=768&waitTime=2000&outFormat=png&url=

Here is another example of screehshot api from [thum.io](https://www.thum.io)

https://image.thum.io/get/width/256/crop/900/

### OPEN_IN_NEW_TAB ###
Bookmark is opened in the same tab by default. Set this variable to true to enable bookmark opened in new tab.

### BASIC_AUTH ###
Basic authentication is off by default, set this variable to true to enable basic authentication for the bookmark access.

### USER_NAME ###
The default username for basic authentication is 'admin', use this variable to set your username for basic authentication.

### PASSWORD ###
The default password for basic authentication is 'admin', use this variable to set your password for basic authentication.

## Volume Setting
### /data ###
This is where the data json and thumbnail stored, map this volume widht read/write permission so the data and thumgnail can be access and backup
