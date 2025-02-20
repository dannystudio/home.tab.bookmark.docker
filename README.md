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
* Bookmark data store in server and cached in browser.
* Import Data: Import data to browser cache. Support import from browser bookmark (Netscape Bookmark File) and SpeedDials. (Only import label and url for bookmarks, no thunbmails).
* Expprt Data: Export data from browser cache or from server.
* Restore Data: In case any mistake , use Restore Data to restore data from server.
* Commit Changes: To avoid any mistake, changes only applied to browser cache (including importing data), use Commit Changes to commit changes to server when needed.

#### Protection
* Basic authentication available as an option. (see BASIC_AUTH in ENV Variables below).

#### Keyboard Intergration
* Force to open bookmark in new tab by holding shift key when click on bookmark.
* Close popups including add, edit, import, and messages by press esc key.

## Installation
#### Home Tab Bookmark Web App
* Clone this repository.
* Run `npm run dockersave` in terminal.
* Use image *home-tab-bookmark.tar* to create container.
* Use `http://HOSTNAME:PORT` to access the application, `http://localhost:3000` for example.

#### Browser New Tab Redirect Extension
Edge / Chrome
* Go to Extensions and select Manage Extensions.
* Switch on Developer Mode.
* Select Load Unpacked.
* Navigate to the repository you have cloned and select the `browser_extension` folder, the extension should be ready for use.
* Navigate to Home Tab Bookmark application, `http://localhost:3000`.
* Select Home Tab Bookmark from Extensions and click Use Current Tab.
* Or, you can input the url of the Home Tab Bookmark application manually and then click Save.

## ENV Variables

#### SCREENSHOT_API
Specify the screenshot api gives option to use different screenshot api to get the screenshot for bookmark thumbnail. The screenshot api should be full api url without bookmark's url and it should return a png or jpeg image.

Here is an example of screenshot api from [elestio/ws-screenshot.slim](https://hub.docker.com/r/elestio/ws-screenshot.slim) docker  
`http://[IP_ADDRESS]]:[PORT]/api/screenshot?resX=1024&resY=768&waitTime=2000&outFormat=png&url=`

Here is another example of screehshot api from [thum.io](https://www.thum.io)  
`https://image.thum.io/get/width/256/crop/900/`

#### BASIC_AUTH
Basic authentication is `disabled` by default, set this variable to `always` or `whitelist` to enable basic authentication.

#### BASIC_AUTH_WHITE_LIST
When basic authentication set to `whitelist`, this variable can be used to set the white list of the host names that can skip the basic authentication. `localhost:3000` is in the white list by default, multiple host names can be set by use comma as separator.

#### USER_NAME
The default username for basic authentication is `admin`, use this variable to set your username for basic authentication.

#### PASSWORD
The default password for basic authentication is `admin`, use this variable to set your password for basic authentication.

## Volume Setting

#### /app/data
This is where the data and thumbnail are stored, map this volume with read/write permission if needed.
