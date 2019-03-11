#!/bin/bash
source ./config/env
echo 'cat <<END_OF_TEXT' >  temp.sh
cat "./config/env-tmpl"                 >> temp.sh
echo 'END_OF_TEXT'       >> temp.sh
bash temp.sh > ".env"
rm temp.sh
