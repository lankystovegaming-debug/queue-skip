require('esbuild').buildSync({entryPoints:['client/database.js'],bundle:true,format:'iife',platform:'browser',target:['es2020'],outfile:'assets/vendor/database.js',minify:true,legalComments:'eof'});
