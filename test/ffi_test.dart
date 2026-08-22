// ignore_for_file: avoid_print
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:sentinel_desktop/core/ffi/sentinel_core_bindings.dart';

void main() {
  test('SentinelCoreBindings loads and lists presets', () {
    final dllPath = '${Directory.current.path}/dist_native/sentinel-core.dll';
    expect(File(dllPath).existsSync(), isTrue);

    SentinelCoreBindings.instance.init(customPath: dllPath);
    print('isLoaded: ${SentinelCoreBindings.instance.isLoaded}');
    print('version: ${SentinelCoreBindings.instance.version}');

    final presets = SentinelCoreBindings.instance.listPresets();
    print('presets output: $presets');
    expect(presets, isNotEmpty);
    expect(presets, isNot('[]'));

    final traffic = SentinelCoreBindings.instance.getRealtimeTraffic('127.0.0.1:9090');
    print('traffic output: $traffic');
    expect(traffic, isNotEmpty);
  });
}
