# <img src="./img/icon128.png" width="32px" valign="middle">Chrome Extension for Navigation to your default language
![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/afklbjnoklmjbbeibdhpgcfobjlinhck)
![Chrome Web Store Last Updated](https://img.shields.io/chrome-web-store/last-updated/afklbjnoklmjbbeibdhpgcfobjlinhck)
![Chrome Web Store Stars](https://img.shields.io/chrome-web-store/stars/afklbjnoklmjbbeibdhpgcfobjlinhck)
![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/afklbjnoklmjbbeibdhpgcfobjlinhck)

A Chrome extension that removes locale/language from the URL to navigate to the same page in the default language.

## Features

- Automatically navigate to the your default language version of the site by removing a language/locale part from the URL of the supported websites page when moved from other domains.  
  And display a toast message with a link to the original locale page.
- Context menus on supported websites to ...
  1. Navigate to the default language version
  1. Copy a URL without locale/language

## Supported Websites and URL formats

- Microsoft Learn  
  i.e. `https://learn.microsoft.com/<LOCALE>/...`
- AWS Documentation  
  i.e. `https://docs.aws.amazon.com/<LOCALE>/...`
- Google Cloud  
  i.e. `https://cloud.googlecom/...?...&hr=<LANGUAGE>&...`
- GitHub Documentation  
  i.e. `https://docs.github.com/<LANGUAGE>/...`

### Requirements for supported Websites

  1. The URL of each page of the websites  includes locale/language information as a part of the path or one of the query parameters.
  1. The websites can redirect to the each user's default language page if the URL doesn't include the locale/language information 

## Installation

### From Chrome Web Store
This extension can be installed from [Chrome Web Store](https://chromewebstore.google.com/detail/afklbjnoklmjbbeibdhpgcfobjlinhck).


### From this repository
1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd <repository-directory>

2. Install dependencies:
   ```sh
   npm install
   ```

3. Build the project:
   ```sh
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to chrome://extensions/.
   - Enable "Developer mode" using the toggle in the top right corner.
   - Click "Load unpacked" and select the dist directory from the cloned repository.

## Development
### Build Commands
- Build for development:
  ```sh
  npm run build:dev
  ```

- Build for production:
  ```sh
  npm run build
  ```

### Debugging
1. Open the project in Visual Studio Code.
2. Use the provided launch configurations to debug in Chrome or Edge:
   - Open the Debug panel.
   - Select "Launch Chrome" or "Launch Edge".
   - Click the green play button to start debugging.

## Change logs

### [0.0.2](https://github.com/horihiro/Navigation-to-your-language-ChromeExtension/releases/tag/0.0.2)
Bug fix
  - Cannot redirect when opening on new tab/window [#1](https://github.com/horihiro/Navigation-to-your-language-ChromeExtension/issues/1)

### [0.0.1](https://github.com/horihiro/Navigation-to-your-language-ChromeExtension/releases/tag/0.0.1)
The First release

## License
MIT © horihiro

----

This file was generated by GitHub Copilot
