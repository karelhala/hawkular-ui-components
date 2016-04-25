#!/usr/bin/env bash
#execute this only when pull requesting to master, or pushing to master
export GH_BRANCH=gh-pages
if [ "${TRAVIS_BRANCH}" = "master" ] && [ ${GH_TOKEN} ]; then
        set -e

        # remove folder with github pages branch and recreate it
        rm -rf "../${GH_BRANCH}"
        git clone -b ${GH_BRANCH} "https://${GH_REF}.git" "../${GH_BRANCH}"
        rm -rf "../${GH_BRANCH}/${TRAVIS_PULL_REQUEST}"
        mkdir "../${GH_BRANCH}/${TRAVIS_PULL_REQUEST}"

        # copy dist/ folder to gh-pages folder and change to it
        cp ./dist/* "../${GH_BRANCH}/${TRAVIS_PULL_REQUEST}/" -rf 2>/dev/null || :
        cd "../${GH_BRANCH}"

        # add whole repo (currently only contains of dist/prId)
        git add .
        git config user.name "Publish PR"
        git config user.email "<your@email.com>"
        git commit -m "Deploy to GitHub Pages"

        export CURRENT_BRANCH=$(git branch --no-color 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/\1/');
        # push to GH_BRANCH in a way where we can't push to some different page
        git push --quiet "https://${GH_TOKEN}@${GH_REF}.git" ${CURRENT_BRANCH}:${GH_BRANCH}
fi
