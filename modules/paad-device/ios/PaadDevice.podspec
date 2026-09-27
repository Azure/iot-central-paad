Pod::Spec.new do |s|
  s.name = 'PaadDevice'
  s.version = '1.0.0'
  s.summary = 'Local PAAD secure MQTT transport and torch capabilities'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'PAAD'
  s.homepage = 'https://github.com/Azure/iot-central-paad'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/Azure/iot-central-paad.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
