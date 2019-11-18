#!/bin/bash
source .env
cd build || exit 1

echo "PUBLIC_URL: ${PUBLIC_URL}"
echo "ASSETS_PATH: ${ASSETS_PATH}"

ctx_url_encoded=$(echo "${CONTEXT_URL//\//\\\/}")
assets_path_encoded=$(echo "${ASSETS_PATH//\//\\\/}")

# RENAME all generated static files to use ?version=XXX notation instead of hashes

sed -i -e "s/main.[[:alnum:]]*.css/main.css?version=${VERSION}/g" index.html

# rename main.*.css to main.css
mv ./static/css/main.*.css.map ./static/css/main.css.map
mv ./static/css/main.*.css ./static/css/main.css

# rename fonts in css files
sed -i -e "s/fontello.[[:alnum:]]*.eot)/fontello.eot?version=${VERSION})/g" static/css/main.css
sed -i -e "s/fontello.[[:alnum:]]*.woff2)/fontello.woff2?version=${VERSION})/g" static/css/main.css
sed -i -e "s/fontello.[[:alnum:]]*.svg)/fontello.svg?version=${VERSION})/g" static/css/main.css
sed -i -e "s/fontello.[[:alnum:]]*.woff2)/fontello.woff2?version=${VERSION})/g" static/css/main.css
sed -i -e "s/fontello.[[:alnum:]]*.ttf)/fontello.ttf?version=${VERSION})/g" static/css/main.css
sed -i -e "s/fontello.[[:alnum:]]*.woff)/fontello.woff?version=${VERSION})/g" static/css/main.css

sed -i -e "s/main.[[:alnum:]]*.js/main.js?version=${VERSION}/g" index.html

# rename main.*.js to main.js
mv ./static/js/main.*.js.map ./static/js/main.js.map
mv ./static/js/main.*.js ./static/js/main.js

sed -i -e "s/sourceMappingURL=main.[[:alnum:]]*.js.map/sourceMappingURL=main.js.map/g" static/js/main.js

# rename fontello.*.eot/woff2/svg/ttf/woff to fontello.eot/woff2/svg/ttf/woff
mv ./static/media/fontello.*.eot ./static/media/fontello.eot
mv ./static/media/fontello.*.woff2 ./static/media/fontello.woff2
mv ./static/media/fontello.*.svg ./static/media/fontello.svg
mv ./static/media/fontello.*.ttf ./static/media/fontello.ttf
mv ./static/media/fontello.*.woff ./static/media/fontello.woff

rm ./service-worker.js
rm ./asset-manifest.json
rm ./LiteMol-plugin.min.js

mv ./static ./tmp_static

if [ ! -d "${ASSETS_PATH}" ]; then
  mkdir -p "${ASSETS_PATH}"
fi

mv ./tmp_static "./${ASSETS_PATH}/static"
mv ./assets/* "./${ASSETS_PATH}/"
rm -r ./assets
