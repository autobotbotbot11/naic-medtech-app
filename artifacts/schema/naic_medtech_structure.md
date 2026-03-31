# NAIC Medtech Structured Tree

Client-approved grouping was used for categories/forms.
Common/shared fields were intentionally excluded from the tree below.

Ignored common fields:
- Name
- Age
- Sex
- Date / Date-Time
- Requesting Physician
- Room
- Case Number
- Medical Technologist
- Pathologist

```text
Clinical Microscopy
  Semen
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - SEMEN ANALYSIS
    TIME COLLECTED
      input_type: Manual Entry
    TIME RECEIVED
      input_type: Manual Entry
    TOTAL VOLUME
      input_type: Manual Entry
    LIQUEFACTION TIME
      input_type: Manual Entry
    MOTILITY
      MOTILE
        input_type: Manual Entry
        value_hint: %
      NON MOTILE
        input_type: Manual Entry
        value_hint: %
    MORPHOLOGY
      NORMAL
        input_type: Manual Entry
        value_hint: %
      ABNORMAL
        input_type: Manual Entry
        value_hint: %
    SPERM COUNT
      note: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
      RESULT
        input_type: Manual Entry
    OTHERS
      WBC
        input_type: Manual Entry
        value_hint: /HPF
      RBC
        input_type: Manual Entry
        value_hint: /HPF
      EPITHELIAL CELL
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
  Urine
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - URINE KETONE
        - URINALYSIS
        - URINALYSIS, URINE KETONE
        - URINALYSIS, PREGNANCY TEST
        - URINALYSIS, PREGNANCY TEST (BLOOD)
        - PREGNANCY TEST
        - PREGNANCY TEST (BLOOD)
    MACROSCOPIC FINDING
      Color
        input_type: Predefined Selection
        dropdown_options:
          - LIGHT YELLOW
          - YELLOW
          - DARK YELLOW
          - AMBER
          - REDDISH YELLOW
          - RED
      Transparency
        input_type: Predefined Selection
        dropdown_options:
          - SLIGHTLY HAZY
          - HAZY
          - TURBID
          - CLEAR
      Reaction
        input_type: Predefined Selection
        dropdown_options:
          - ACIDIC 5.0
          - ACIDIC 6.0
          - ACIDIC 6.5
          - NEUTRAL 7.0
          - ALKALINE 7.5
          - ALKALINE 8.0
          - ALKALINE 9.0
      Specific Gravity
        input_type: Predefined Selection
        dropdown_options:
          - 1.005
          - 1.010
          - 1.015
          - 1.020
          - 1.025
          - 1.030
    CLINICAL FINDING
      Sugar
        input_type: Predefined Selection
        dropdown_options:
          - NEGATIVE
          - TRACE
          - +
          - ++
          - +++
          - ++++
      Protein
        input_type: Predefined Selection
        dropdown_options:
          - NEGATIVE
          - TRACE
          - +
          - ++
          - +++
          - ++++
    MICROSCOPIC FINDING
      White Blood Cell
        input_type: Manual Entry
        value_hint: /HPF
      Red Blood Cell
        input_type: Manual Entry
        value_hint: /HPF
      Epithelial Cell
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      Amorphous Urates
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      Amorphous Phosphate
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      Calcium Oxalate
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      Uric Acid Crystal
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      Mucus Thread
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      Bacteria
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      Others
        input_type: Manual Entry
      Pregnancy Test
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
  Fecalysis
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - FECALYSIS
        - FOBT
        - FECALYSIS, FOBT
        - SCOTCH TAPE METHOD
    MACROSCOPIC FINDING
      COLOR
        input_type: Predefined Selection
        dropdown_options:
          - YELLOW
          - YELLOWISH
          - YELLOWISH GREEN
          - YELLOWISH BROWN
          - BROWN
          - LIGHT BROWN
          - DARK BROWN
          - REDDISH BROWN
          - GREENISH
          - GREENISH YELLOW
          - BLACK
          - REDDISH
          - GRAYISH
      CONSISTENCY
        input_type: Predefined Selection
        dropdown_options:
          - FORMED
          - SEMI-FORMED
          - SOFT
          - SOFT-WATERY
          - SOFT-MUCOID
          - WATERY
          - MUCOID
      FECAL OCCULT BLOOD
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
    MICROSCOPIC FINDING
      PUS
        input_type: Manual Entry
        value_hint: /HPF
      RED BLOOD CELL
        input_type: Manual Entry
        value_hint: /HPF
      BUDDING YEAST
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      BACTERIA
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      FAT GLOBULES
        input_type: Predefined Selection
        dropdown_options:
          - OCCASIONAL
          - FEW
          - MODERATE
          - PLENTY
      PARASITES
        input_type: Predefined Selection
        dropdown_options:
          - ASCARIS LUMBRICOIDES OVA
          - TRICHURIS TRICHIURA OVA
          - NO OVA NOR PARASITES SEEN
      AMOEBA
        input_type: Predefined Selection
        dropdown_options:
          - ENTAMOEBA HISTOLYTICA/ENTAMOEBA DISPAR CYSTS
          - ENTAMOEBA COLI CYSTS
      OTHERS
        input_type: Predefined Selection
        dropdown_options:
          - BLASTOCYSTIS HOMINIS CYSTS

Blood Chemistry
  OGTT
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - 50g OGTT
        - 75g OGTT
        - 100g OGTT
        - 2-HOUR POSTPRANDIAL
        - 50g ORAL GLUCOSE CHALLENGE
    50G ORAL GLUCOSE TOLERANCE
      note: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
      1ST HOUR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: < 200 mg/dl
      2ND HOUR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: < 140 mg/d
    75G ORAL GLUCOSE TOLERANCE
      note: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
      FASTING BLOOD SUGAR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: 70.27-124.32 mg/dl
      1ST HOUR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: < 200 mg/dl
      2ND HOUR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: < 140 mg/dl
    100G ORAL GLUCOSE TOLERANCE
      note: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
      FASTING BLOOD SUGAR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: 70.27-124.32 mg/dl
      1ST HOUR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: < 180 mg/dl
      2ND HOUR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: < 155 mg/dl
      3RD HOUR
        input_type: Manual Entry
        value_hint: mg/dl
        normal_value: < 140 mg/dl
    Additional Tests
      2 HOURS POST PRANDIAL
        input_type: Manual Entry
        value_hint: mg/dl
      50 G ORAL GLUCOSE CHALLENGE
        input_type: Manual Entry
        value_hint: mg/dl
      Others
        input_type: Manual Entry
  HBA1C
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - HBA1C (CLOVER)
    Result
      input_type: Manual Entry
      value_hint: %
      normal_value: NORMAL VALUE = 4.0 - 5.6 %
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
  Male
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - CHEM 6
        - CHEM 4, LIPID PROFILE
        - CHEM 4, LIPID PROFILE, AST, ALT
        - LIPID PROFILE
        - FBS, LIPID PROFILE
        - FBS, BUA, LIPID PROFILE
        - BUN, CREA, SERUM ELECTROLYTES
        - CHEM 4, LIPID PROFILE, AST, ALT, SERUM ELECTROLYTES
        - BUN, CREA
        - BUN, CREA, BUA, SERUM ELECTROLYTES
        - SERUM ELECTROLYTES
        - CHEM 4, LIPID PROFILE, SERUM ELECTROLYTES
    FASTING BLOOD SUGAR
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 70.27-124.32 mg/dL
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
    RANDOM BLOOD SUGAR
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 60 - 140 mg/dl
      notes: note: pde po kaya na incase na magpplit po ng normal values pde nmin sya maedit, ty
    HGT
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 53 - 103 mg/dl
    BLOOD UREA NITROGEN
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 7.9- 20.2 mg/dl
    CREATININE
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 0.5-1.3 mg/dl
    BLOOD URIC ACID
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 3.5 - 7.2 mg/dl
    SODIUM
      input_type: Manual Entry
      value_hint: mEq/L
      normal_value: 135 - 148 mEq/L
    POTASSIUM
      input_type: Manual Entry
      value_hint: mEq/L
      normal_value: 3.5 - 5.3 mEq/L
    CHLORIDE
      input_type: Manual Entry
      value_hint: mEq/L
      normal_value: 98 - 107 mEq/L
    IONIZED CALCIUM
      input_type: Manual Entry
      value_hint: mEq/L
      normal_value: 1.13-1.32 mEq/L
    CHOLESTEROL
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 0 - 200 mg/dl
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
    TRIGLYCERIDE
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 0 - 150 mg/dl
    HDL CHOLESTEROL
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 30 - 85 mg/dl
    LDL CHOLESTEROL
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 66 - 178 mg/dl
    VLDL CHOLESTEROL
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 0-40 mg/dl
    SGOT(AST)
      input_type: Manual Entry
      value_hint: U/L
      normal_value: 0 - 31 U/L
    SGPT(ALT)
      input_type: Manual Entry
      value_hint: U/L
      normal_value: 0 - 34 U/L
    OTHERS
      input_type: Manual Entry
  Female
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - CHEM 6
        - CHEM 4, LIPID PROFILE
        - CHEM 4, LIPID PROFILE, AST, ALT
        - LIPID PROFILE
        - FBS, LIPID PROFILE
        - FBS, BUA, LIPID PROFILE
        - BUN, CREA, SERUM ELECTROLYTES
        - CHEM 4, LIPID PROFILE, AST, ALT, SERUM ELECTROLYTES
        - BUN, CREA
        - BUN, CREA, BUA, SERUM ELECTROLYTES
        - SERUM ELECTROLYTES
        - CHEM 4, LIPID PROFILE, SERUM ELECTROLYTES
    FASTING BLOOD SUGAR
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 70.27-124.32 mg/dL
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
    RANDOM BLOOD SUGAR
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 60 - 140 mg/dl
    HGT
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 53 - 103 mg/dl
    BLOOD UREA NITROGEN
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 7.9- 20.2 mg/dl
    CREATININE
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 0.4-1.2 mg/dl
    BLOOD URIC ACID
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 2.6 - 6.0 mg/dl
    SODIUM
      input_type: Manual Entry
      value_hint: mEq/L
      normal_value: 135 - 148 mEq/L
    POTASSIUM
      input_type: Manual Entry
      value_hint: mEq/L
      normal_value: 3.5 - 5.3 mEq/l
    CHLORIDE
      input_type: Manual Entry
      value_hint: mEq/L
      normal_value: 98 - 107 mEq/L
    IONIZED CALCIUM
      input_type: Manual Entry
      value_hint: mEq/L
      normal_value: 1.13-1.32 mEq/L
    CHOLESTEROL
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 0 - 200 mg/dl
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
    TRIGLYCERIDE
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 0 - 150 mg/dl
    HDL CHOLESTEROL
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 30 - 85 mg/dl
    LDL CHOLESTEROL
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 66 - 178 mg/dl
    VLDL CHOLESTEROL
      input_type: Manual Entry
      value_hint: mg/dl
      normal_value: 0-40 mg/dl
    SGOT(AST)
      input_type: Manual Entry
      value_hint: U/L
      normal_value: 0 - 31 U/L
    SGPT(ALT)
      input_type: Manual Entry
      value_hint: U/L
      normal_value: 0 - 34 U/L
    OTHERS
      input_type: Manual Entry

Serology
  Serology
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - DENGUE TEST
        - ASO TITER
        - TYHPIDOT
        - HBSAG SCREENING
        - VDRL
        - ANTI-HCV
    TYPHIDOT
      IgM
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
      IgG
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
    DENGUE TEST
      Ns1Ag
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
      IgM
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
      IgG
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
    MALARIAL TEST
      ANTI-PLASMODIUM FALCIFARUM
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
      ANTI PLASMODIUM VIVAX
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
    Other Serology Tests
      HbsAg SCREENING
        input_type: Predefined Selection
        dropdown_options:
          - REACTIVE
          - NON-REACTIVE
      VDRL
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE
          - NEGATIVE
      ANTI-HCV
        input_type: Predefined Selection
        dropdown_options:
          - REACTIVE
          - NON-REACTIVE
      ASO TITER
        input_type: Predefined Selection
        dropdown_options:
          - POSITIVE >200 IU/ML
          - NEGATIVE <200 IU/ML
      OTHERS
        input_type: Manual Entry
  Cardiaci
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - CK-MB, TNI, BNP
    CK-MB
      input_type: Manual Entry
      value_hint: ng/mL
      normal_value: 0.0 - 4.3 ng / mL
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
    TROPONIN - I
      input_type: Manual Entry
      value_hint: ng/mL
      normal_value: 0.0 - 0.02 ng /mL
    BNP
      input_type: Manual Entry
      value_hint: pg/mL
      normal_value: 0.0 - 100 pg / mL
  HIV 1&2 Testing
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - HIV TESTING
    LOT NUMBER
      input_type: Manual Entry
    TEST RESULT
      input_type: Predefined Selection
      dropdown_options:
        - REACTIVE
        - NON-REACTIVE
  COVID 19 Antigen (Rapid Test)
    note: kelangan may picture sa result
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - COVID 19-ANTIGEN TEST
    TEST RESULT
      input_type: Predefined Selection
      dropdown_options:
        - NEGATIVE
        - POSITIVE

Blood Bank
  Examination
    input_type: Predefined Selection
    dropdown_options:
      - CROSSMATCHING
  PATIENT'S BLOOD TYPE
    input_type: Predefined Selection
    dropdown_options:
      - "A" rh POSITIVE
      - "B" rh POSITIVE
      - "AB" rh POSITIVE
      - "O" rh POSITIVE
      - "A" rh NEGATIVE
      - "B" rh NEGATIVE
      - "O" rh NEGATIVE
      - "AB" rh NEGATIVE
  BLOOD COMPONENT
    input_type: Predefined Selection
    dropdown_options:
      - WHOLE BLOOD
      - PRBC
      - WB TO PRBC
      - PLATELET CONCENTRATE
      - FRESH FROZEN PLASMA
  DONOR'S BLOOD TYPE
    input_type: Predefined Selection
    dropdown_options:
      - "A" rh POSITIVE
      - "B" rh POSITIVE
      - "AB" rh POSITIVE
      - "O" rh POSITIVE
      - "A" rh NEGATIVE
      - "B" rh NEGATIVE
      - "O" rh NEGATIVE
      - "AB" rh NEGATIVE
  SOURCE OF BLOOD
    input_type: Predefined Selection
    dropdown_options:
      - PRC CAVITE CITY
      - PRC DASMARINAS
      - PRC SILANG
      - PRC CALOOCAN
      - PAGAMUTAN NG DASMARINAS
      - GEAMH
      - EACMED
      - TSMC
      - DLSUMC
      - GENTRIMED
  SERIAL NUMBER
    input_type: Manual Entry
  DATE EXTRACTED
    input_type: Manual Entry
  DATE EXPIRY
    input_type: Manual Entry
  TYPE OF CROSSMATCHING
    IMMEDIATE SPIN/ SALINE PHASE
      input_type: manual entry
    ALBUMIN PHASE /37 deg C
      input_type: manual entry
    ANTI HUMAN GLOBILIN PHASE
      input_type: manual entry
    REMARKS
      input_type: Predefined Selection
      dropdown_options:
        - COMPATIBLE
        - INCOMPATIBLE
    VITAL SIGNS
      input_type: Predefined Selection
      notes: dapat meron na dropdownlist sa blood pressure, pulse rate, resparatory rate, temperature then mag iinput na lang ng result
      dropdown_options:
        - BLOOD PRESSURE: mmHg
        - PULSE RATE: bpm
        - RESPIRATORY RATE: cpm
        - TEMPERATURE: deg C
    RELEASED BY
      input_type: Manual Entry
      value_options:
        - IMELDA A. ELEMIA
        - CRYSTEL C. TESORO
        - JULIE KYLE A. RONATO
        - MA. JESUSA B. VITE
        - ANDREA COLEEN A, AVELLONES
        - SHIELA MAE D. LIBRADILLA
    RELEASED TO
      input_type: Manual Entry

Blood Gas Analysis
  Examination
    input_type: Predefined Selection
    dropdown_options:
      - ABG
  Blood gas value (ABG)
    pH
      input_type: Manual Entry
      normal_value: 7.35-7.45
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
    pO2
      input_type: Manual Entry
      value_hint: mmHg
      normal_value: 80-105 mmHg
    pCO2
      input_type: Manual Entry
      value_hint: mmHg
      normal_value: 35.0-45.0 mmHg
  Calculated values (OXIMETRY)
    sO2
      input_type: Manual Entry
      value_hint: %
      normal_value: 95-100 %
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
  Calculated values (ACID BASE STATUS)
    HCO3
      input_type: Manual Entry
      value_hint: mmol/L
      normal_value: 22-28 mmol/L
      notes: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
    BE(ecf)
      input_type: Manual Entry
      value_hint: mmol/L
      normal_value: -2 to +2 mmol/L
    pO2(A-a)
      input_type: Manual Entry
      value_hint: mmHg
      normal_value: 5-10 mmHg
    TCO2
      input_type: Manual Entry
      value_hint: mmol/L
      normal_value: 23-29 mmol/L
    NOTE
      input_type: Manual Entry

Hematology
  Hematology
    note: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - CBC, PLATELET COUNT, BLOOD TYPING
        - HGB-HCT, PLATELET COUNT
        - BLOOD TYPING
        - CBC, PLATELET COUNT, ESR
        - CBC, PLATELET COUNT
    RBC COUNT (M)
      input_type: Manual Entry
      value_hint: /L
      normal_value: 4.6 - 6.2 X 1012/L
    RBC COUNT (F)
      input_type: Manual Entry
      value_hint: /L
      normal_value: 4.2 - 5.4 X 1012/L
    WBC COUNT
      input_type: Manual Entry
      value_hint: /L
      normal_value: 5.0 - 10.0 X 109/L
    HEMOGLOBIN (M)
      input_type: Manual Entry
      value_hint: g/L
      normal_value: 140-180 g/L
    HEMOGLOBIN (F)
      input_type: Manual Entry
      value_hint: g/L
      normal_value: 120 - 160 g/L
    HEMATOCRIT (M)
      input_type: Manual Entry
      value_hint: /L
      normal_value: 0.40-0.54 /L
    HEMATOCRIT (F)
      input_type: Manual Entry
      value_hint: /L
      normal_value: 0.37 - 0.42 /L
    PLATELET COUNT
      input_type: Manual Entry
      value_hint: /L
      normal_value: 150 - 450 X 109/L
    CLOTTING TIME
      input_type: Manual Entry
      value_hint: minutes
      normal_value: 1 - 6 minutes
    BLEEDING TIME
      input_type: Manual Entry
      value_hint: minutes
      normal_value: 1 - 6 minutes
    BLOOD TYPING
      input_type: Predefined Selection
      dropdown_options:
        - "A" rh POSITIVE
        - "B" rh POSITIVE
        - "AB" rh POSITIVE
        - "O" rh POSITIVE
        - "A" rh NEGATIVE
        - "B" rh NEGATIVE
        - "O" rh NEGATIVE
        - "AB" rh NEGATIVE
    SEGMENTERS
      input_type: Manual Entry
      normal_value: 0.50 - 0.70
    LYMPHOCYTES
      input_type: Manual Entry
      normal_value: 0.25 - 0.40
    MONOCYTES
      input_type: Manual Entry
      normal_value: 0.03 - 0.08
    EOSINOPHILS
      input_type: Manual Entry
      normal_value: 0.01 - 0.04
    STAB
      input_type: Manual Entry
      normal_value: 0 - 0.05
    E.S.R . (M)
      input_type: Manual Entry
      value_hint: mm/hr
      normal_value: 0 - 10 mm/hr
    E.S.R . (F)
      input_type: Manual Entry
      value_hint: mm/hr
      normal_value: 0 - 20 mm/hr
    OTHERS
      input_type: Manual Entry
  Pro-Time, APTT
    Examination
      input_type: Predefined Selection
      dropdown_options:
        - PROTIME
        - APTT
        - PROTIME, APTT
    PRO TIME
      note: NOTE: ALL RESULTS ABOVE OR BELOW NORMAL VALUE MAKE IT RED
      TEST
        input_type: Manual Entry
        value_hint: SECONDS
        normal_value: 10.0-13.9 seconds
      CONTROL
        input_type: Manual Entry
        value_hint: SECONDS
        normal_value: SECONDS
      INR
        input_type: Manual Entry
        normal_value: 0.70-1.30
      % ACTIVITY
        input_type: Manual Entry
        value_hint: %
        normal_value: % ACTIVITY
    APTT
      TEST
        input_type: Manual Entry
        value_hint: SECONDS
        normal_value: 22.2-37.9 seconds
      CONTROL
        input_type: Manual Entry
        value_hint: SECONDS
        normal_value: SECONDS

Microbiology
  Examination
    input_type: Predefined Selection
    dropdown_options:
      - KOH SMEAR
  RESULT
    input_type: Predefined Selection
    dropdown_options:
      - NO FUNGAL ELEMENTS SEEN
      - POSITIVE FOR FUNGAL ELEMENTS

```
