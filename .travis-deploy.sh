#!/usr/bin/env bash
#execute this only when pull requesting to master, or pushing to master
export GH_BRANCH=gh-pages
# run this only if branch is master and we are not in pull request
if [ "$TRAVIS_BRANCH" = "master" ] && [ $TRAVIS_PULL_REQUEST = "false" ]; then
        set -e
        rm -rf "../${GH_BRANCH}"
        git clone -b ${GH_BRANCH} "https://${GH_REF}.git" "../${GH_BRANCH}"

        cp ./dist/* "../${GH_BRANCH}" -rf 2>/dev/null || :
        cd "../${GH_BRANCH}"

        git add .
        git config user.name "Travis CI"
        git config user.email "<your@email.com>"
        git commit -m "Deploy to GitHub Pages"

        export CURRENT_BRANCH=$(git branch --no-color 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/\1/');
        # push to GH_BRANCH in a way where we can't push to some different page
        git push --quiet "https://${GH_TOKEN}@${GH_REF}.git" ${CURRENT_BRANCH}:${GH_BRANCH}
fi
