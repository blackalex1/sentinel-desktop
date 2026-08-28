
import os
for root, _, files in os.walk('.'):
    for file in files:
        if file.endswith(('.cs', '.json', '.axaml', '.md', '.txt', '.py')):
            filepath = os.path.join(root, file)
            if os.path.isfile(filepath):
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        data = f.read()
                    if '127.0.0.1' in data:
                        new_data = data.replace('127.0.0.1', '127.0.0.1')
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_data)
                except Exception:
                    pass
