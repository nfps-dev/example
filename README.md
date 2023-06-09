# NFP Basic Example

An example project for building an NFP's front-end UI (the SVG file and application script).


## Bootloader vs App

NFP front-end development is divided into two subdirectories: the bootloader, and the app. Each one has its own build process, but they share configs in the root directory(`package.json`, `tsconfig.json`, `.eslintrc.js`, etc.).


### Bootloader

For maximum portability, robustness, and longevity, a bootloader is a tiny minified script that fetches the NFP's latest packages from the chain and hydrates the running SVG document (e.g., by injecting scripts). The bootloader ensures that the raw, original SVG file can forever be opened and run as a standalone web application in any modern browser.

The `@nfps.dev/runtime` package provides a function that can be called by the project's bootloader to automatically handle resolving the NFP's dependencies by reading the requisite children of the `<metadata>` element. This approach allows project's to add some custom UI or logic to their bootloader flow.

**NOTICE: NFP SVGs are immutable. Once an SVG is stored on chain, its bootloader cannot be modified.**


### App

Unlike the bootloader, a project's main application can be updated by deploying new package versions to the chain. The 'app' consists of any such packages, although most projects will only ever need to use a single `main.js` entrypoint script produced by a bundler (e.g., one produced by Vite).

The SVG stored on chain references a package by its id and a tag, e.g., `<nfp:script src="main.js?tag=latest" />`.


## Directory Structure

The root directory contains the `package.json` for managing the dependencies used by `app/` and `bootloader/`.

 - `app/` -- source for the project's main app bundle
 - `bootloader/` -- source for the project's bootloader
 - `media/` -- assets used as inputs to the build process
 - `build.mjs` -- a Node.js script that builds the output SVG file
 - `deploy.mjs` -- a Node.js script that uploads built app bundles to the chain as new packages versions


# Getting Started

1. Install the project

    ```sh
    yarn install
    ```

2. Set up environment variables

    ```sh
    cp .env.example .env
    ```

3. Generate or import a private key

    You can generate a new account by simply running `node deploy.mjs` without a value set for the private key env var.

    Or, you can import a private key from `secretcli` using the following command:
    ```sh
    secretcli keys export ACCOUNT_NAME --unarmored-hex --unsafe
    ```

4. Build everything

	 For production:
    ```sh
    yarn build
    ```

	 OR

	 For development:
	 ```sh
	 yarn dev
	 ```

    > While developing, you can use `yarn watch:dev` to automatically reload on file changes

5. Deploy the app to chain

    ```sh
    yarn deploy:app  # simply calls `node deploy.mjs`
    ```

6. Open the built SVG file in a web browser (`file://` protocol works!) or preview in no-script mode using other means.

Outputs:
 - `dist/nfp.svg` - the built and minified SVG file
 - `dist/ngp.svg.gz - the gzipped, production-ready SVG meant for deployment on chain
 - `dist/nfp.dev.svg` - a developer-friendly SVG which links to styles and scripts instead of inlining them (be aware that this version is only intended for debugging within in a browser, linked assets do not work in no-script mode)
 - `dist/preview.html` - a preview of embedding the SVG as an image in an HTML document (i.e., to preview in no-script mode)

#### Notes

For each task in `package.json`:
 - `build` produces production-ready output
 - `dev` produces developer-friendly output
 - `watch` is same as dev but with automatic reloading
