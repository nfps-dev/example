
# Modules

NFPs are loaded into the browser as SVG documents, not as HTML documents. Consequently `<script>` elements [behave differently](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/script), including the fact that they do not support native ECMAScript modules.

To work around this limitation, the nfps.dev SDK provides a rollup plugin that rewrites import/export expressions to read from and write to properties on a special object defined in the global scope. This allows modules to share data, functions, and objects with each other. Modules that reuse exported items from previously loaded ones benefit from reduced bundle sizes. Since the items are already in memory by the time the dependent module loads, re-deriving them or importing them from the same dependency would be redundant and increase that module's bundle size.

The following sections detail some nuances to working with the NFP module system.



## Static Imports and Exports

The entry file for any module can use `export` expressions to synchronously expose items to other modules, just as expected.

```ts
/* applibs/src/foo/main.ts */
const foo = 'foo';

export {
  foo,
};
```


Other modules can use `import` expressions to synchronously import items from other modules that **have already been loaded** into the SVG document.

The import specifier has a special syntax to denote such imports: `nfpx:${PACKAGE_ID}`:

```ts
/* applibs/src/bar/main.ts */
import {
  foo,
} from 'nfpx:foo';
```


If a module has not yet been loaded into the SVG document but the script depends on it, then a dynamic import is needed.



## Dynamic Imports

To load a module into the app from a script, the module's source code needs to be downloaded from the chain and appended to the document as a `<script>` element. Under the hood, this retrieval happens by querying the NFP's smart contract for the corresponding package file.

```ts
/* applibs/src/baz/main.ts */

// start by loading some necessary objects that are exported by bootloader
import {
  K_CONTRACT,
  A_TOKEN_LOCATION,
} from 'nfpx:bootloader';

// top-level await is forbidden, run in iife
(async() => {
  // perform dynamic import; the 2nd argument provides necessary data for the query
  const {
    foo,
  } = await import('nfpx:foo', {
    contract: K_CONTRACT,
    location: A_TOKEN_LOCATION,
  });
})();
```


In some cases, the package is private and the querier must be authenticated in order to download it. Revising the code block above, the `auth` key in the 2nd argument provides either a query permit or viewing key to the contract during the query:

```ts
// ...

  // not shown here: acquire query permit or viewing key to perform authenticated query
  const authInfo = G_QUERY_PERMIT || [SH_VIEWING_KEY, SA_OWNER];

  // perform dynamic import; the 2nd argument provides necessary data for the query
  const {
    foo,
  } = await import('nfpx:foo', {
    contract: K_CONTRACT,
    location: A_TOKEN_LOCATION,
    auth: authInfo,
    query: {  // optionally provide some filter criteria too
      tag: '1.x',
    },
  });
```


## Dynamic Exports

Sometimes a module needs to perform some tasks asynchronously before exporting data. Since the NFP module system uses a shared global object to exchange data, modules are able to augment or overwrite exported items at any time.

```ts
/* applibs/src/qux/main.ts */

(async() => {
  const quxData = await someAsyncTask();

  // after this call, other modules will be able to import `qux` from this module
  exportNfpx({
    qux: quxData,
  });
})();

```


## Destructuring Imported Modules

After a module has been dynamically imported, or after an imported module has dynamically exported some items, the developer needs to acquire those items from a certain scope/context, but they don't need to re-import the already loaded module.

For example, this situation often arises in the script portion of a svelte component. Its entry script (for this example having package id `app`) dynamically imports a module `foo` and then instantiates the svelte component. By the time the svelte component starts initializing, the imported module `foo` is already loaded into the SVG document, but the component's scope was not the one who imported it.

Notice that it wouldn't make sense to use a static import in the svelte component since `app` needs to _dynamically_ import `foo`. Also, keep in mind that static import expressions from a svelte component will get reordered to the top of the output bundle since all static imports happens synchronously (i.e., before the svelte component is ever loaded).

Finally, using a dynamic import from the svelte component would cause `foo` to load again which would lead to undefined behavior.

Instead, the svelte component simply needs access to the members of the dynamically imported `foo` module (which was done by the entry script). This can be done using a reserved function `destructureImportedNfpModule`:

```ts
/* app/src/main.ts */
import App from './App.svelte';

(async() => {
  // import the foo module
  await import('nfpx:foo', {
    contract: K_CONTRACT,
    location: A_TOKEN_LOCATION,
  });

  // load the svelte component
  new App({
    target: document.body,
  });
})();'
```

```svelte
<!-- app/src/App.svelte -->
<script lang="ts">
  // 'foo' module is guaranteed to be loaded according to the script logic shown in the entry script above
  const {
    foo,
  } = destructureImportedNfpModule('foo');
</script>
```


### Troubleshooting

In some cases, `destructureImportedNfpModule` may show a type error about its argument. This can happen for instance if a svelte component is attempting to destructure members exported by its own parent module, but that parent isn't a dependency of any other modules in the project. Therefore, the global augmentation from that module's type definitions never get loaded. To fix this, simply add a type-only import to the entry file, importing its own type definitions:

```ts
/* app/src/main.ts */
import type {} from 'nfpx:app';
```

#### Importing from self

Another issue that can arise when using `destructureImportedNfpModule` to import items from the same (current) module, is that the identifier is not found in the module's exports:
```
"{IDENTIFIER}" export not found in app module
```

This can happen because the SDK is trying to find the identifier in the module's compiled export table, but the module hasn't compiled yet. In this scenario, you need to first compile the module with the new export before using that identifier in any destructuring calls from within the same module.

```ts
/* app/src/main.ts */

(async() => {
  await someAsyncTask();

  exportNfpx({
    FOOBAR: 'data',
  });
});
```

```ts
/* app/src/App.svelte */
const {
  FOOBAR,  // causing error: "FOOBAR" export not found in app module
} = destructureImportedNfpModule('app');
```

**Solution:**

Temporarily disable the import and compile.

```ts
/* app/src/App.svelte */
const {
  // FOOBAR,
} = destructureImportedNfpModule('app');

// temporary decl to satisfy type-checker and linters
let FOOBAR!: string;
```

Now, `FOOBAR` should be defined in the app's exports in `.nfp-modules.json`. You should be able to revert the file and compile.
