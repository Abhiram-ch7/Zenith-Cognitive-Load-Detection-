import pandas as pd

def clean_file(input_file, output_file):
    df = pd.read_csv(input_file)

    # Remove invalid timestamps
    df = df[pd.to_numeric(df['timestamp'], errors='coerce').notnull()]

    # Keep only key_press events
    df = df[df['event_type'] == 'key_press']

    # Remove unwanted keys
    bad_keys = ['Key.alt_l', 'Key.tab', 'Key.ctrl_l', 'Key.shift']
    df = df[~df['value'].isin(bad_keys)]

    # Remove duplicates
    df = df.drop_duplicates()

    # Save cleaned file
    df.to_csv(output_file, index=False)

    print(f"{output_file} cleaned and saved!")

# Clean both files
clean_file("high.csv", "high_cleaned.csv")
clean_file("low.csv", "low_cleaned.csv")