# MOSDAC Data Access & Download Guide for POLARIS

This directory contains the official **ISRO MOSDAC Data Download API (`mdapi.py`)** integrated for the POLARIS Polar Logistics, Operations, Resource & Asset Intelligence System.

---

## 1. Security & Privacy Notice
> [!IMPORTANT]
> **Never share your MOSDAC password in chat.**
> Your credentials stay strictly on your local machine in `scripts/mosdac/config.json`, which is permanently added to `.gitignore`.

---

## 2. Quick Setup

### Step 1: Create your local `config.json`
Copy the template to create your active configuration:
```powershell
cp scripts/mosdac/config.template.json scripts/mosdac/config.json
```

### Step 2: Add your approved credentials & search parameters
Open `scripts/mosdac/config.json` and fill in:
- `username/email`: Your approved MOSDAC username or email.
- `password`: Your MOSDAC password.
- `datasetId`: The product identifier (see catalog below).
- `startTime` & `endTime`: Date range in `YYYY-MM-DD` format.
- `download_path`: Target folder (defaults to `./data/mosdac/`).
- `skip_user_input`: Set to `true` for unattended batch download.

---

## 3. Recommended Polar & Maritime Dataset IDs

| Dataset / Mission | ID Example | Operational Utility in POLARIS |
|---|---|---|
| **Oceansat-3 (EOS-06) Scatterometer** | `OS3_SCAT_L2B_OWV` / `3S_SCAT` | Southern Ocean wind vectors & storm tracking along Cape Town ⇄ Bharati route |
| **INSAT-3DR / 3DS Sea Surface Temperature** | `3RIMG_L2B_SST` | Oceanic temperature gradients and thermal fronts |
| **INSAT-3DR / 3DS Imager** | `3RIMG_L1B_STD` / `3SIMG_L1B_STD` | Atmospheric cloud cover & polar weather tracking |
| **Sea Ice Occurrence Probability (SIOP)** | `SIOP` | Historical Antarctica sea-ice navigation risk assessment |
| **Antarctic AWS (Automatic Weather Stations)** | `AWS_MET` | In-situ ground meteorological verification at Maitri and Bharati |

*(You can also browse the complete live catalog by logging into the [MOSDAC Web Portal](https://www.mosdac.gov.in) and checking the product code under Search & Download).*

---

## 4. Running the Download

Run the download script using `uv` (recommended, isolated dependencies) or standard Python:

```powershell
# Using uv (isolated, installs requests + tqdm automatically)
& "$env:LOCALAPPDATA\hermes\bin\uv.exe" run --with requests --with tqdm python scripts/mosdac/mdapi.py

# Or if you have requests installed in your active Python environment:
python scripts/mosdac/mdapi.py
```

The data files will be downloaded directly to `./data/mosdac/`.
