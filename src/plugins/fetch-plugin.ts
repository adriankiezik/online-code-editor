import * as esbuild from 'esbuild-wasm';
import axios from 'axios';
import localForage from 'localforage';

const fileCache = localForage.createInstance({
  name: 'file-cache',
});

export const fetchPlugin = (inputCode: string) => {
  return {
    name: 'fetch-plugin',
    setup(build: esbuild.PluginBuild) {
      // Handle root file
      build.onLoad({ filter: /(^index\.js$)/ }, () => {
        return {
          loader: 'jsx',
          contents: inputCode,
        };
      });

      // Handle css files (quite workaround)
      build.onLoad({ filter: /.css$/ }, async (args: any) => {
        // Check if file has been already cached
        const cachedResult = await fileCache.getItem<esbuild.OnLoadResult>(
          args.path
        );
        if (cachedResult) {
          return cachedResult;
        }

        const { data, request } = await axios.get(args.path);

        const escapedData = data
          .replace(/\n/g, '')
          .replace(/"/g, '')
          .replace(/'/g, '');

        const contents = `
          const style = document.createElement('style');
          style.innerText = '${escapedData}';
          document.head.appendChild(style);
          `;

        const result: esbuild.OnLoadResult = {
          loader: 'jsx',
          contents,
          resolveDir: new URL('./', request.responseURL).pathname,
        };

        // Store response in cache
        await fileCache.setItem(args.path, result);

        return result;
      });

      // Handle js/jsx files
      build.onLoad({ filter: /.*/ }, async (args: any) => {
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
