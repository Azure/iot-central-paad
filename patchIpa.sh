#!/bin/bash

# Usage:

# 1. Copy the script into a text editor and save it with no extension
# 2. Make it executable like so: chmod +x path/to/script
# 3. Run it from the Terminal in one of two ways:
#       * path/to/script ipa_path="path/to/ipa" archive_path="path/to/xcarchive"
#       * path/to/script ipa_path="path/to/ipa" toolchain_path="path/to/toolchain"

for ARGUMENT in "$@"
do

    KEY=$(echo $ARGUMENT | cut -f1 -d=)
    VALUE=$(echo $ARGUMENT | cut -f2 -d=)

    case "$KEY" in
            ipa_path)          ipaPath=${VALUE} ;; # Format: "Path/to/app.ipa"
            archive_path)      archivePath=${VALUE} ;; # Format: "Path/to/app.xcarchive"
            toolchain_path)    toolchainPath=${VALUE} ;; # Format: "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift-5.0/iphoneos"
            *)
    esac

done

echo "ipaPath=$ipaPath"
echo "archive_path=$archivePath"
echo "toolchain_path=$toolchainPath"

# Derived Variables
ipaDirectory=$(dirname "$ipaPath")
echo "ipaDirectory=$ipaDirectory"

ipaName=$(basename "$ipaPath")
echo "ipaName=$ipaName"

zipName=${ipaName/.ipa/.zip}
echo "zipName=$zipName"

appName=${ipaName/.ipa/}
echo "appName=$appName"

zipSuffix="-unzipped"
echo "zipSuffix=$zipSuffix"

unzippedDirectoryName="$appName$zipSuffix"
echo "unzippedDirectoryName=$unzippedDirectoryName"

newIpaSuffix="-with-swift-support"
echo "newIpaSuffix=$newIpaSuffix"

newIpaName="$appName$newIpaSuffix"
echo "newIpaName=$newIpaName"

swiftSupportPath="SwiftSupport/iphoneos"
echo "swiftSupportPath=$swiftSupportPath"

ipaSwiftSupportDirectory="$ipaDirectory/$unzippedDirectoryName/$swiftSupportPath"
echo "ipaSwiftSupportDirectory=$ipaSwiftSupportDirectory"

# Changes the .ipa file extension to .zip and unzips it
function unzipIPA {
    mv "${ipaDirectory}/${ipaName}" "${ipaDirectory}/${zipName}"
    echo "Unzipping $ipaDirectory/$zipName"
    unzip "${ipaDirectory}/${zipName}" -d "${ipaDirectory}/${unzippedDirectoryName}"
}

# Copies the SwiftSupport folder from the .xcarchive into the .ipa
function copySwiftSupportFromArchiveIntoIPA {
    mkdir -p "$ipaSwiftSupportDirectory"
    echo "Created $ipaSwiftSupportDirectory from Archive"
    cd "${archivePath}/${swiftSupportPath}"
    for file in *.dylib; do
        cp "$file" "$ipaSwiftSupportDirectory/$file.orig"
        lipo "$ipaSwiftSupportDirectory/$file.orig" -remove arm64e -remove armv7s -output "$ipaSwiftSupportDirectory/$file"
        rm "$ipaSwiftSupportDirectory/$file.orig"
    done
}

# Creates the SwiftSupport folder from the Xcode toolchain and copies it into the .ipa
function copySwiftSupportFromToolchainIntoIPA {
    echo "Created $ipaSwiftSupportDirectory from Toolchain"
    mkdir -p "$ipaSwiftSupportDirectory"
    cd "${ipaDirectory}/${unzippedDirectoryName}/Payload/${appName}.app/Frameworks"
    for file in *.dylib; do
      echo "$file"
      cp "$toolchainPath/$file" "$ipaSwiftSupportDirectory/$file.orig"
      lipo "$ipaSwiftSupportDirectory/$file.orig" -remove arm64e -remove armv7s -output "$ipaSwiftSupportDirectory/$file"
      rm "$ipaSwiftSupportDirectory/$file.orig"
    done
}

# Adds the SwiftSupport folder from one of two sources depending on the presence of an .xcarchive
function addSwiftSupportFolder {
  if [ -z "$archivePath" ]
  then
    copySwiftSupportFromToolchainIntoIPA
  else
    copySwiftSupportFromArchiveIntoIPA
  fi
}

# Zips the new folder back up and changes the extension to .ipa
function createAppStoreIPA {
    cd "${ipaDirectory}/${unzippedDirectoryName}"
    zip -r "${ipaDirectory}/${newIpaName}.zip" ./*
    mv "${ipaDirectory}/${newIpaName}.zip" "${ipaDirectory}/${newIpaName}.ipa"
}

# Renames original .ipa and deletes the unzipped folder
function cleanUp {
    mv "${ipaDirectory}/${zipName}" "${ipaDirectory}/${ipaName}"
    rm -r "${ipaDirectory}/${unzippedDirectoryName}"
}

# Execute Steps
unzipIPA
addSwiftSupportFolder
createAppStoreIPA
cleanUp