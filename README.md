# Home Tab Bookmark

Selfhosted SpeedDial style bookmark for browser home tab.

![screenshot](https://github.com/user-attachments/assets/d0d78c2d-e515-400e-a815-a646bf230b3e)

## Requirements

#### Environment
* Linux, Windows or Mac OS
* Node.js 18+

#### Browser
* Microsoft Edge
* Chrome
* Firefox
* Safari (May have issue when moving group/bookmark)

## Features

#### Bookmark Group
* Add groups.
* Right click on group name to edit/delete group.
* Drag and drop group to change the order of the group.

#### Bookmark
* Add bookmark in group.
* Right click on bookmark to edit/delete bookmark.
* options to use favicon or screenshot from bookmark url, or upload image for bookmark thumbnail.
* option to use favicon or screenshot from custom url for bookmark thumbnail.
* drag and drop bookmark to change the position of bookmark.
* drag and drop bookmark to move to another group.

#### Data
* Bookmark data store in contain and cached in browser's local storage.
* Import Data: Import data to local storage.
* Expprt Data: Export data from local storage.
* Restore Data: In case any mistake , use Restore Data to restore data from container.
* Commit Changes: Changes only applied to local storage, use Commit Changes to commit changes to container.

#### Protection
* Basic authentication available as an option. (see BASIC_AUTH in ENV Variables below).

#### Keyboard Intergration
* Force to open bookmark in new tab by holding shift key when click on bookmark.
* Close popups including add, edit, import, and messages by press esc key.

## Installation
* Clone this repository.
* Run `npm run dockersave` in terminal.
* Use image *home-tab-bookmark.tar* to create container.
* Install browser extension [New Tab Redirect](https://chromewebstore.google.com/detail/new-tab-redirect/icpgjfneehieebagbmdbhnlpiopdcmna?hl=en-US) and set new tab redirect to http://HOSTNAME:3000.

## ENV Variables

#### SCREENSHOT_API
Specify the screenshot api gives option to use different screenshot api to get the screenshot for bookmark thumbnail. The screenshot api should be full api url without bookmark's url and it should return a png or jpeg image.

Here is an example of screenshot api from [elestio/ws-screenshot.slim](https://hub.docker.com/r/elestio/ws-screenshot.slim) docker  
`http://[IP_ADDRESS]]:[PORT]/api/screenshot?resX=1024&resY=768&waitTime=2000&outFormat=png&url=`

Here is another example of screehshot api from [thum.io](https://www.thum.io)  
`https://image.thum.io/get/width/256/crop/900/`

#### OPEN_IN_NEW_TAB
Bookmark is opened in the same tab by default. Set this variable to true to enable bookmark opened in new tab.

#### MAX_BOOKMARK_PER_ROW
Use this variable to change the maximum number of bookmarks per row. (default is 6 bookmarks per row).

#### BASIC_AUTH
Basic authentication is off by default, set this variable to true to enable basic authentication.

#### USER_NAME
The default username for basic authentication is 'admin', use this variable to set your username for basic authentication.

#### PASSWORD
The default password for basic authentication is 'admin', use this variable to set your password for basic authentication.

## Volume Setting

#### /app/data
This is where the data and thumbnail are stored, map this volume with read/write permission if needed.
