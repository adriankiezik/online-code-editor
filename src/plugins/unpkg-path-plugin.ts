import * as esbuild from 'esbuild-wasm';
import axios from 'axios';
import localForage from 'localforage';

const fileCache = localForage.createInstance({
  name: 'file-cache',
});

// Plugin for esBuild that fetches and loades packages from unpkg.

export const unpkgPathPlugin = () => {
  return {
    name: 'unpkg-path-plugin',
    setup(build: esbuild.PluginBuild) {
      // onResolve runs when esBuild finds file to load
      build.onResolve({ filter: /.*/ }, async (args: any) => {
        console.log('onResolve', args);
        if (args.path === 'index.js') {
          return { path: args.path, namespace: 'a' };
        }
        // Handle nested files
        if (args.path.includes('./') || args.path.includes('../')) {
          return {
            namespace: 'a',
            path: new URL(
              args.path,
              'https://unpkg.com' + args.resolveDir + '/'
            ).href,
          };
        }
        // Handle main file of package
        return {
          namespace: 'a',
          path: `https://unpkg.com/${args.path}`,
        };
      });

      // onLoad runs when esBuild is loading some file
      build.onLoad({ filter: /.*/ }, async (args: any) => {
        console.log('onLoad', args);

        if (args.path === 'index.js') {
          return {
            loader: 'jsx',
            contents: `console.log("Loaded local file.");
            `,
          };
        }
        // If file being loaded is not local,
        // fetch url provided by resolve function.

        // Check if file has been already cached
        const cachedResult = await fileCache.getItem<esbuild.OnLoadResult>(
          args.path
        );
        if (cachedResult) {
          return cachedResult;
        }

        const { data, request } = await axios.get(args.path);

        const result: esbuild.OnLoadResult = {
          loader: 'jsx',
          contents: data,
          resolveDir: new URL('./', request.responseURL).pathname,
        };

        // Store response in cache
        await fileCache.setItem(args.path, result);

        return result;
      });
    },
  };
};
