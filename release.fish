#!/usr/bin/env fish

cd (dirname (status -f));

function usage
    echo 'Usage: ./release.fish <version> [branch]' >&2
    echo '    version: major.minor.patch' >&2
    echo '    branch: branch to merge --no-ff before committing' >&2
    exit 1
end

set argc (count $argv)
if test $argc -lt 1
    usage
end

if test $argc -eq 2
    set branch $argv[2]
else if test $argc -gt 2
    usage
end

set newversion $argv[1]

set oldversion (grep -F '"version"' manifest.json | cut -d':' -f2 | cut -d'"' -f2)

set ov (echo $oldversion | tr '.' '\n' )
set nv (echo $newversion | tr '.' '\n' )

if test (count $nv) -lt 3
    echo "Invalid version number: $newversion" >&2
    echo 'Please use X.Y.Z (with X, Y and Z numbers)' >&2
    exit 2
end

function abortOlder
    echo "Version $newversion is lower than $oldversion" >&2
    echo 'Aborting...'
    exit 3
end

if test $nv[1] -lt $ov[1]
    abortOlder
else if test $nv[1] -eq $ov[1]
    if test $nv[2] -lt $ov[2]
        abortOlder
    else if test $nv[2] -eq $ov[2]
        if test $nv[3] -lt $ov[3]
            abortOlder
        else if test $nv[3] -eq $ov[3]
            echo "Version number hasn't changed: $newversion" >&2
            echo 'Aborting...'
            exit 4
        end
    end
end

echo "Updating from version $oldversion to $newversion" >&2

git diff --quiet; or begin
    echo 'There are untracked changes. Please add and commit all changes before creating a new release' >&2
    exit 5
end

git diff --quiet --cached; or begin
    echo 'There are uncommitted changes. Please commit these changes before creating a new release' >&2
    exit 6
end

if set -q branch
    # merge!
    git merge --no-ff $branch -m "merge $branch"
end

# update version
sed -i'' -e "s/\"version\"\:.*\$/\"version\": \"$newversion\",/" manifest.json
# set name to non-dev value
sed -i'' -e 's/"name"\:.*$/"name": "Ingress Identity",/' manifest.json
# set logging to false
sed -i'' -e 's/enableLogging = true,$/enableLogging = false,/' js/log.js
git add manifest.json js/log.js

git commit -m "[release] v$newversion"

git tag -s "v$newversion"; or begin
    echo 'git-tag aborted' >&2
    exit $status
end

git push
git push --tags

git archive -o "versions/v$newversion.zip" HEAD
