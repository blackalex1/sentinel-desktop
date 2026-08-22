import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App basic widget test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Text('SENTINEL SECURE'),
        ),
      ),
    );
    expect(find.text('SENTINEL SECURE'), findsOneWidget);
  });
}
