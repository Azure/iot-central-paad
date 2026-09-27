#!/usr/bin/env ruby
# frozen_string_literal: true

# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
#
# Generates the dedicated Xcode project that builds the native XCUITest runner.
#
# The project contains exactly one target: a UI-testing bundle. It deliberately
# has no application target and no TEST_TARGET_NAME, so xcodebuild emits an
# .xctestrun with `UseUITargetAppProvidedByTests` instead of a `UITargetAppPath`.
# The already-built, already-installed application is therefore never rebuilt,
# never re-signed and never referenced by this project.

require 'fileutils'
require 'json'
require 'xcodeproj'

NAME = 'PaadLiveUITests'
BUNDLE_IDENTIFIER = 'com.microsoft.iotpnp.ci.uitests'
DEPLOYMENT_TARGET = '16.4'

if ARGV.length > 2
  warn 'Usage: create-ios-uitest-project.rb [project-dir] [swift-source]'
  exit 1
end

project_dir = File.expand_path(ARGV[0] || 'build/ios-uitest')
source = File.expand_path(ARGV[1] || File.join(__dir__, "#{NAME}.swift"))

unless File.file?(source) && !File.symlink?(source)
  warn 'Missing the reviewed XCUITest source.'
  exit 1
end

build = File.expand_path('build')
unless File.directory?(build) && !File.symlink?(build) &&
       project_dir == File.join(build, 'ios-uitest') &&
       !File.exist?(project_dir) && !File.symlink?(project_dir)
  warn 'The XCUITest project requires a fresh owned build/ios-uitest directory.'
  exit 1
end
Dir.mkdir(project_dir, 0o700)
sources_dir = File.join(project_dir, NAME)
FileUtils.mkdir_p(sources_dir)
FileUtils.cp(source, File.join(sources_dir, "#{NAME}.swift"))

project_path = File.join(project_dir, "#{NAME}.xcodeproj")
project = Xcodeproj::Project.new(project_path)
target = project.new_target(:ui_test_bundle, NAME, :ios, DEPLOYMENT_TARGET)
group = project.new_group(NAME, NAME)
target.add_file_references([group.new_file(File.join(sources_dir, "#{NAME}.swift"))])

settings = {
  'PRODUCT_BUNDLE_IDENTIFIER' => BUNDLE_IDENTIFIER,
  'PRODUCT_NAME' => '$(TARGET_NAME)',
  'GENERATE_INFOPLIST_FILE' => 'YES',
  'SWIFT_VERSION' => '5.0',
  'TARGETED_DEVICE_FAMILY' => '1,2',
  'IPHONEOS_DEPLOYMENT_TARGET' => DEPLOYMENT_TARGET,
  'SDKROOT' => 'iphoneos',
  'ENABLE_TESTING_SEARCH_PATHS' => 'YES',
  'LD_RUNPATH_SEARCH_PATHS' =>
    '$(inherited) @executable_path/Frameworks @loader_path/Frameworks',
  'SWIFT_INSTALL_OBJC_HEADER' => 'NO',
  # Simulator-only bundle. Leaving it unsigned is what keeps iOS keychain or
  # application-identifier entitlements out of every produced signature.
  'CODE_SIGNING_ALLOWED' => 'NO',
  'CODE_SIGNING_REQUIRED' => 'NO',
  'CODE_SIGN_IDENTITY' => '',
  'CODE_SIGN_ENTITLEMENTS' => '',
  'CODE_SIGN_STYLE' => 'Manual',
  'DEVELOPMENT_TEAM' => '',
  'PROVISIONING_PROFILE_SPECIFIER' => '',
}
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!(settings)
end

project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)

build_action = scheme.build_action
build_action.parallelize_buildables = false
build_action.build_implicit_dependencies = false

test_action = scheme.test_action
test_action.build_configuration = 'Release'
test_action.code_coverage_enabled = false
test_action.should_use_launch_scheme_args_env = false
# Do not retain automatic attachments; raw runner output remains private.
test_attributes = test_action.xml_element.attributes
test_attributes['systemAttachmentLifetime'] = 'keepNever'
test_attributes['userAttachmentLifetime'] = 'keepNever'

scheme.analyze_action.build_configuration = 'Release'
scheme.archive_action.build_configuration = 'Release'
scheme.launch_action.build_configuration = 'Release'
scheme.profile_action.build_configuration = 'Release'
scheme.save_as(project_path, NAME, true)

puts JSON.generate(
  schemaVersion: 1,
  project: project_path,
  scheme: NAME,
  testTarget: NAME,
  bundleIdentifier: BUNDLE_IDENTIFIER,
  runnerHostBundleIdentifier: "#{BUNDLE_IDENTIFIER}.xctrunner"
)
