# Module 1: Bond Fundamentals

Est. study time: 2h

## Learning Objectives
- Define key bond terms: face value, coupon, maturity, yield
- Explain inverse relationship between price and yield
- Distinguish premium, par, and discount bonds
- Calculate current yield and understand YTM

---

## Core Content

### What is a bond?

Bond = loan from investor to issuer. Issuer pays periodic interest, repays principal at maturity.

### Key terms

| Term | Definition |
|------|------------|
| **Face value (par)** | Principal repaid at maturity. Usually $1,000 per bond |
| **Coupon rate** | Annual interest rate (% of face value) |
| **Coupon payment** | Periodic interest = coupon rate × face value ÷ frequency |
| **Maturity** | Date principal is repaid |
| **Yield** | Return investor earns (varies with price) |
| **Price** | Market price (can be above, below, or at par) |

### Price-yield relationship

**Inverse**: When yield goes UP, price goes DOWN. When yield goes DOWN, price goes UP.

Reason: fixed coupon. If market rates rise, existing bonds with lower coupons become less valuable → price falls to match new yield.

Question: Why is price quoted as % of $1,000 par instead of dollar amount? Answer: % convention lets you compare bonds with different face values instantly. 95 across all of them means same thing relative to par.

### Premium, par, discount

| Price vs Par | Bond type | Yield vs Coupon |
|-------------|-----------|-----------------|
| Price = Par | Par bond | Yield = Coupon |
| Price > Par | Premium bond | Yield < Coupon |
| Price < Par | Discount bond | Yield > Coupon |

### Pull-to-par intuition

Discount bond price rises toward par as maturity nears.

Reason: not driven by rates — purely mechanical. Shorter time horizon means PV of principal dominates, and PV of $1,000 at any positive yield converges to $1,000 as maturity shrinks.

Question: If you buy discount bond at $950 and hold to maturity, is gain from rates or just mechanics? Answer: mechanical. Price must converge to par at maturity regardless of rate path.

### Current yield

`Current yield = Annual coupon / Market price`

Simple approximation. Does not account for maturity gain/loss.

### Yield to Maturity (YTM)

Total return if held to maturity. Includes:
- Coupon payments
- Gain/loss from price difference to par
- Reinvestment assumption (coupons reinvested at same YTM)

YTM = IRR of bond's cash flows. Most important yield measure.

---

## Examples

### Example 1
Bond: $1,000 face value, 5% coupon (annual), 10yr maturity

Annual coupon = $50

If market price = $1,000:
- Current yield = $50/$1,000 = 5%
- Yield = coupon rate (par bond)

If market price = $950:
- Current yield = $50/$950 = 5.26%
- YTM > 5.26% (buyer gets $50/yr + $50 gain at maturity)

### Example 2 (Private Bank context)
Client holds $1M face of 4% Treasuries. Fed raises rates → new Treasuries yield 5%.

What happens to client's bond value? Price falls. Old 4% bonds less attractive → price drops until yield matches 5%.

As broker, you explain: "Paper loss if marked to market, but if held to maturity full principal returned."

---

## Common Misconception

"Higher coupon bond is always better." No. Discount bond (low coupon) has built-in price gain at maturity (accretion). Total return from YTM perspective may be same for bond with low coupon + price gain vs high coupon + stable price.

## Key Takeaways
- Bonds = loans with fixed coupons, defined maturity
- Price and yield move inversely
- Premium bonds: price > par, yield < coupon
- Discount bonds: price < par, yield > coupon
- YTM is the complete return measure (coupons + price gain/loss)

---

## Feynman Explain
Teach price-yield relationship to a colleague who doesn't do fixed income. Use simplest words. No jargon ("duration", "convexity", "YTM"). Give concrete example from private bank context — a client's bond losing value when rates rise.

*Self-check: Did you use vague words like "basically" or "kind of"? Did you skip WHY prices fall (fixed coupon less attractive vs new bonds)?*

Run: `./scripts/learn.sh explain fixed-income 01-bond-fundamentals`

---

## Reframe
Judge the price-yield relationship: When does the inverse relationship NOT hold? (Think: distressed bonds, zero-coupon bonds, very short maturity.) Write your answer.

---

## Drill
Take the quiz. MCQs test recall, application, and private bank scenarios.

Run: `./scripts/learn.sh quiz fixed-income 01-bond-fundamentals`

## Quiz: 01-bond-fundamentals


### A bond with face value $1,000 and coupon rate 6% pays how much annually?

- [✓] A: $60

- [ ] B: $6

- [ ] C: $600

- [ ] D: $1,060


**Answer:** A

Annual coupon = coupon rate × face value = 0.06 × $1,000 = $60


### Bond selling above face value is called a ___ bond

- [ ] A: discount

- [✓] B: premium

- [ ] C: par

- [ ] D: zero-coupon


**Answer:** B

Premium bond: market price &gt; face value. Yield &lt; coupon rate.


### If market interest rates rise, what happens to existing bond prices?

- [ ] A: They rise

- [✓] B: They fall

- [ ] C: They stay the same

- [ ] D: They double


**Answer:** B

Inverse relationship. New bonds pay higher coupons → old bonds less attractive → price falls to match yield.


### Current yield is $50 annual coupon / $950 market price. What is it?

- [ ] A: 5.00%

- [✓] B: 5.26%

- [ ] C: 4.76%

- [ ] D: 5.50%


**Answer:** B

$50/$950 = 0.0526 = 5.26%. Current yield ignores maturity gain/loss.


### For a discount bond, which is true?

- [✓] A: Yield &gt; coupon rate

- [ ] B: Yield &lt; coupon rate

- [ ] C: Yield = coupon rate

- [ ] D: Yield is zero


**Answer:** A

Discount bond: price &lt; par. Buyer gets coupon + price appreciation to par → YTM &gt; coupon rate.


### Client holds $5M par of 3% bonds. Market now yields 4%. What best describes client's position?

- [ ] A: Bonds trading at premium

- [✓] B: Bonds trading at discount

- [ ] C: Bonds trading at par

- [ ] D: Bonds have been called


**Answer:** B

Market yields (4%) &gt; coupon (3%) → bonds must sell below par to be competitive. Client holds discount bonds.


### Which yield measure accounts for both coupon income AND price change from purchase to maturity?

- [ ] A: Current yield

- [ ] B: Coupon rate

- [✓] C: Yield to Maturity

- [ ] D: Dividend yield


**Answer:** C

YTM = total return assuming held to maturity: coupons + price convergence to par. Current yield ignores price gain/loss.


### A premium bond is purchased. Which is most likely TRUE over its life?

- [ ] A: Bond price rises towards maturity

- [✓] B: Bond price falls towards par at maturity

- [ ] C: Bond price stays constant

- [ ] D: Bond is always called before maturity


**Answer:** B

Premium bond price gradually declines to par as maturity approaches. Buyer loses premium over time, offset by higher coupon.


### Two bonds identical except Bond A = 5yr maturity, Bond B = 10yr maturity. Rates rise 1%. Which price falls more?

- [ ] A: Bond A

- [✓] B: Bond B

- [ ] C: Both fall equally

- [ ] D: Neither price changes


**Answer:** B

Longer maturity = more future cash flows discounted at new higher rate. Price impact greater for longer bonds.


### Private banking context: client says 'my bond fund lost 2% value this month'. Most likely cause?

- [ ] A: Bond default

- [✓] B: Interest rates increased

- [ ] C: Coupon payment missed

- [ ] D: Fund fees increased


**Answer:** B

Monthly bond fund value changes are overwhelmingly driven by interest rate moves (via inverse price relationship). Default is rare for IG.


---

# Module 2: Time Value of Money & Bond Pricing

Est. study time: 2h

## Learning Objectives
- Explain time value of money concept
- Calculate present value of future cash flows
- Price bond using discounted cash flow method
- Understand YTM as IRR of bond cash flows
- Distinguish spot rates from YTM

---

## Core Content

### Time Value of Money

$1 today worth more than $1 tomorrow. Reason: can invest today's dollar and earn interest.

Key variables:
- **PV**: Present Value (price today)
- **FV**: Future Value (principal + interest)
- **r**: Discount rate (yield)
- **n**: Number of periods
- **PMT**: Periodic payment

### Future Value

```
FV = PV × (1 + r)^n
```

Example: $1,000 today at 5% for 3 years
```
FV = 1,000 × (1.05)^3 = $1,157.63
```

### Present Value

```
PV = FV / (1 + r)^n
```

Example: $1,000 received in 3 years, discount at 5%
```
PV = 1,000 / (1.05)^3 = $863.84
```

### Bond Pricing Formula

Bond price = PV of all future cash flows (coupons + principal)

```
P = C/(1+r)^1 + C/(1+r)^2 + ... + C/(1+r)^n + FV/(1+r)^n
```

Where:
- C = coupon payment per period
- r = periodic yield (YTM / periods per year)
- n = total periods
- FV = face value (par)

### Semi-annual convention

Most bonds pay coupons semi-annually (2x per year).

Why semi-annual? Historically aligned with corporate earnings cycles (6-month reporting). Also gives investors more frequent cash flow vs annual. European bonds often annual — convention varies by region.

Question: If bond is semi-annual and you halve yield to 2.5%, does this assume compounding? Answer: Yes. Effective annual yield = (1.025)^2 - 1 = 5.0625%, slightly above stated 5% YTM. Semi-annual convention understates effective yield vs annual.

Example: 5yr bond, 6% coupon, YTM 5%, semi-annual

```
Periodic coupon = (0.06 × $1,000) / 2 = $30
Periods = 5 × 2 = 10
Periodic yield = 5% / 2 = 2.5%
```

Price = PV of 10 semi-annual coupons of $30 + PV of $1,000 at maturity

P = $30 × [1 - (1.025)^-10] / 0.025 + $1,000 / (1.025)^10

P = $30 × 8.752 + $1,000 × 0.7812

P = $262.56 + $781.20 = $1,043.76 (premium bond)

### Annuity formula shortcut

Coupons form an annuity. Use:

```
PV_annuity = C × [1 - (1+r)^-n] / r
```

Then add PV of principal.

### YTM as IRR

YTM = discount rate that makes PV of cash flows equal market price.

Cannot solve directly (iterative). Use financial calculator or `=YIELD()` in Excel.

```
Price = Σ C/(1+YTM/2)^t + FV/(1+YTM/2)^n
```

Common misconception: "YTM = actual return if held to maturity." No. YTM assumes every coupon reinvested at same YTM. If reinvestment rates differ, realized return differs. For high-coupon bonds in falling-rate environment, realized return < YTM.

### Spot rates vs YTM

| Concept | Definition |
|---------|------------|
| **Spot rate** | Yield on zero-coupon bond for specific maturity |
| **YTM** | Single discount rate applied to ALL cash flows |
| **Implication** | YTM assumes constant reinvestment rate across time — unrealistic |

Bootstrapping: derive spot rates from coupon bonds.

Question: If spot curve is upward sloping, what does YTM overstate or understate? Answer: YTM (single rate) understates yield on distant cash flows and overstates yield on near cash flows. Spot rates give truer picture.

### Accrued interest & clean/dirty price

- **Clean price**: Quoted price, excludes accrued interest
- **Dirty price**: Clean + accrued interest = actual cash paid
- **Accrued interest**: Coupon earned by seller since last payment

Transaction settled between coupon dates → buyer pays seller accrued interest.

---

## Examples

### Example 1: Basic bond pricing

Bond: $1,000 face, 4% coupon (annual), 3yr maturity, YTM 3.5%

```
P = 40/(1.035)^1 + 40/(1.035)^2 + 1040/(1.035)^3
P = 38.65 + 37.34 + 939.78
P = $1,015.77 (premium)
```

### Example 2: Private bank context

Client sees bond quoted at clean price 98.50. Coupon 5% semi-annual, last coupon paid 60 days ago (182-day period).

```
Accrued interest = (5%/2) × (60/182) × $1,000 = 2.5% × 0.33 × $1,000 = $8.24
Dirty price = $985.00 + $8.24 = $993.24
Client pays $993.24.
```

### Example 3: YTM approximation

Bond: $1,000 face, 5% coupon, 5yr, price $960

Approximate YTM formula:
```
YTM ≈ [C + (FV - P)/n] / [(FV + P)/2]
YTM ≈ [50 + (1000-960)/5] / [(1000+960)/2]
YTM ≈ [50 + 8] / 980 = 58/980 = 5.92%
```

Check: actual YTM ≈ 5.95% (close).

---

## Common Misconception

"YTM = total return if held to maturity." Only if every coupon reinvested at same YTM. In falling-rate world, realized return < YTM. In rising-rate world, realized return > YTM.

## Key Takeaways
- Bond price = sum of PV of future cash flows
- Semi-annual convention: halve coupon and yield, double periods
- YTM = single discount rate matching price to cash flows
- Spot rates differ from YTM — YTM assumes flat reinvestment rate
- Clean price excludes accrued interest; dirty price is actual cost

---

## Feynman Explain
Explain bond pricing to a colleague: "Why does a bond's price change when rates move?" Use discounting concept — no formulas. Connect to Module 1's price-yield relationship using TVM reasoning.

*Self-check: Can you explain why a $1,000 par bond paying $30 semi-annually for 10 years is worth MORE than $1,000 when rates are 5% but LESS when rates are 7%?*

Run: `./scripts/learn.sh explain fixed-income 02-time-value-of-money-and-bond-pricing`

---

## Reframe
When does bond pricing as PV of cash flows break down? Consider: perpetual bonds (no maturity), floating-rate notes (coupon resets), convertible bonds (equity option embedded). Write your answer.

---

## Drill
Take the quiz. MCQs test TVM calculations, bond pricing, YTM, and accrued interest.

Run: `./scripts/learn.sh quiz fixed-income 02-time-value-of-money-and-bond-pricing`

## Quiz: 02-time-value-of-money-and-bond-pricing


### Present value of $5,000 received in 4 years, discount rate 6% annually?

- [✓] A: $3,960.47

- [ ] B: $3,500.00

- [ ] C: $4,200.00

- [ ] D: $4,716.98


**Answer:** A

PV = 5,000 / (1.06)^4 = 5,000 / 1.2625 = $3,960.47


### What is bond price formula based on?

- [ ] A: Average of past prices

- [✓] B: Sum of present value of all future cash flows

- [ ] C: Issuer's credit rating

- [ ] D: Stock price of issuer


**Answer:** B

Bond price = PV(coupons) + PV(face value). Bond is series of future cash flows discounted at market yield.


### 5yr bond, 8% coupon semi-annual, YTM 6%. How many periods and periodic yield?

- [ ] A: 5 periods, 6% periodic yield

- [✓] B: 10 periods, 3% periodic yield

- [ ] C: 10 periods, 6% periodic yield

- [ ] D: 5 periods, 3% periodic yield


**Answer:** B

Semi-annual: periods = 5 × 2 = 10. Periodic yield = 6%/2 = 3%. Periodic coupon = 8%/2 × $1,000 = $40.


### Bond pays $25 coupon semi-annually, face $1,000, 3yr maturity, YTM 4%. What is price?

- [ ] A: $972.50

- [ ] B: $1,000.00

- [✓] C: $1,027.57

- [ ] D: $1,083.33


**Answer:** C

Periodic coupon = $25, periods = 6, periodic yield = 2%. PV coupons = 25 × [1-1.02^-6]/0.02 = 25 × 5.601 = $140.03. PV principal = 1000/1.02^6 = $887.54. Total = $1,027.57


### Clean price $980, accrued interest $12.50. What does buyer actually pay?

- [ ] A: $967.50

- [ ] B: $980.00

- [✓] C: $992.50

- [ ] D: $1,000.00


**Answer:** C

Dirty price = clean + accrued = $980 + $12.50 = $992.50. Buyer pays dirty price.


### YTM assumes which reinvestment condition?

- [ ] A: Coupons reinvested at risk-free rate

- [✓] B: Coupons reinvested at same YTM

- [ ] C: Coupons not reinvested

- [ ] D: Coupons reinvested at current yield


**Answer:** B

YTM assumes all coupons reinvested at same YTM rate. If reinvestment rates differ, realized return differs from YTM.


### Private bank client buys bond quoted at 101.25 clean. Coupon 4% semi-annual, 90 days since last coupon (182-day period). What dirty price?

- [ ] A: $1,012.50

- [ ] B: $1,014.55

- [✓] C: $1,022.39

- [ ] D: $1,032.74


**Answer:** C

Clean = $1,012.50. Accrued = (4%/2) × (90/182) × $1,000 = 2% × 0.495 × $1,000 = $9.89. Dirty = $1,012.50 + $9.89 = $1,022.39


### Spot rate differs from YTM because...

- [ ] A: Spot rate applies one discount rate to all cash flows

- [ ] B: YTM applies different rates per period

- [✓] C: Spot rate applies a unique rate per maturity, YTM applies one rate to all cash flows

- [ ] D: They are identical


**Answer:** C

Spot rates are unique zero-coupon rates per maturity. YTM is single flat rate applied to all cash flows of a bond.


### Bond: $1,000 face, 6% coupon annual, 4yr, price $980. Approximate YTM?

- [ ] A: 5.76%

- [✓] B: 6.47%

- [ ] C: 6.00%

- [ ] D: 7.12%


**Answer:** B

Approx YTM = [60 + (1000-980)/4] / [(1000+980)/2] = [60+5]/990 = 65/990 = 6.57%. Closest: 6.47% using more precise calc.


### Which scenario would make realized return diverge MOST from YTM?

- [ ] A: Bond held to maturity, reinvestment rates constant

- [✓] B: Bond held to maturity, reinvestment rates fall sharply

- [ ] C: Bond sold before maturity at unchanged yields

- [ ] D: Bond held to maturity in flat yield curve environment


**Answer:** B

YTM assumes reinvestment at same rate. If rates fall, reinvested coupons earn less → realized return &lt; YTM. This reinvestment risk is greatest when coupons are large and rates volatile.


---

# Module 3: Government Bonds

Est. study time: 2h

## Learning Objectives
- Describe Treasury bill, note, bond structure
- Understand STRIPS and zero-coupon Treasuries
- Distinguish on-the-run vs off-the-run liquidity
- Explain agency bonds (Fannie Mae, Freddie Mac)
- Use Treasuries as benchmark yield curve

---

## Core Content

### US Treasury securities

| Type | Maturity | Coupon | Notes |
|------|----------|--------|-------|
| **T-Bill** | ≤1yr | Zero-coupon | Discount, no periodic interest |
| **T-Note** | 2-10yr | Semi-annual coupon | Most liquid benchmark |
| **T-Bond** | 20-30yr | Semi-annual coupon | Longest duration |
| **TIPS** | 5-30yr | Inflation-adjusted | Principal indexed to CPI |

### T-Bill pricing

Discount instrument. Price quoted on discount yield basis.

Why 360-day convention? Historical banking practice (pre-computer era) — 360 simplifies interest calc (12 months × 30 days). T-Bill uses discount yield where return is expressed as % of face, not % of price. BEY converts to bond-equivalent for comparison with coupon bonds.

```
Price = Face × (1 - discount_rate × days/360)
```

Example: 90-day T-Bill, discount rate 4%
```
Price = $1,000,000 × (1 - 0.04 × 90/360) = $990,000
```

Actual yield (bond equivalent yield):
```
BEY = (Face - Price)/Price × 365/days
     = $10,000/$990,000 × 365/90 = 4.10%
```

### On-the-run vs off-the-run

- **On-the-run**: Most recently issued. Highest liquidity, tightest bid-ask.
- **Off-the-run**: Previously issued. Wider spreads, lower liquidity.

Premium for liquidity: on-the-run trades at slightly lower yield.

### STRIPS

Separate Trading of Registered Interest and Principal of Securities.

Each coupon and principal becomes separate zero-coupon security.

Example: 10yr Treasury $1,000 face, 4% coupon → 20 semi-annual coupons + 1 principal strip = 21 STRIPS securities.

STRIPS appeal: zero-coupon, known maturity value, no reinvestment risk.

### Agency bonds

Government-sponsored enterprises (GSEs):
- **Fannie Mae** (FNMA): mortgage-backed securities
- **Freddie Mac** (FHLMC): mortgage-backed securities  
- **Federal Home Loan Banks** (FHLB): advance funding to banks
- **Farm Credit System**: agricultural lending

Agency status: implicit government backing (not explicit). Historically bailed out.

Agency yields: between Treasuries and corporate bonds.

Question: If agencies have implicit backing, why yield more than Treasuries? Answer: No explicit guarantee. During 2008 crisis, agencies placed into conservatorship — bondholders made whole but equity wiped out. Market prices this tail risk.

### Benchmark yield curve

Treasury curve = risk-free benchmark for all fixed income.

Used for:
- Pricing corporate bonds (spread over Treasury)
- Valuing derivatives (swap curve benchmark)
- Economic indicator (shape predicts growth/recession)

### Sovereign bonds globally

| Country | Benchmark | Key features |
|---------|-----------|--------------|
| Germany | Bund | Eurozone benchmark |
| UK | Gilt | Long history, liquid |
| Japan | JGB | Low yield, deep market |
| Switzerland | Swiss govt | Negative yield history |
| Emerging markets | Local/Eurobond | Currency risk, higher yield |

---

## Examples

### Example 1: STRIPS private bank

Client wants guaranteed $500,000 in 8 years for child's education. You buy 8yr STRIPS.

If 8yr zero-coupon yield = 4.5%, cost today:
```
PV = $500,000 / (1.045)^8 = $500,000 / 1.4221 = $351,582
```

Known outcome: $500,000 at maturity. No coupon reinvestment risk.

### Example 2: Treasury benchmark spread

Corporate bond priced at 135bp over 5yr Treasury (yield 4.20%).

Corporate yield = 4.20% + 1.35% = 5.55%.

If Treasury yield rises to 4.50%, corporate bond likely yields 5.85% (spread stable) or adjusts if risk perception changes.

---

## Common Misconception

"Treasuries have zero risk." No. Interest rate risk, inflation risk, reinvestment risk, and (for foreign holders) currency risk remain. Only credit/default risk is zero.

## Key Takeaways
- T-Bills: discount, ≤1yr. T-Notes/Bonds: coupon, semi-annual
- On-the-run: most liquid. Off-the-run: cheaper but wider spreads
- STRIPS: zero-coupon Treasuries from separating coupons/principal
- Agencies: GSEs, implicit backing, yield between Treasuries and corporates
- Treasury curve = global risk-free benchmark

---

## Feynman Explain
Explain on-the-run vs off-the-run Treasury liquidity to a private banking client. Why does the newly issued 10yr trade at lower yield than last year's 10yr? Use analogy (new car vs used car?).

*Self-check: Can you explain why STRIPS have zero reinvestment risk?*

Run: `./scripts/learn.sh explain fixed-income 03-government-bonds`

---

## Reframe
Critique the idea that Treasuries are "risk-free." What risks remain? (Inflation, liquidity during crisis, currency for foreign holders, opportunity cost.) Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 03-government-bonds`

## Quiz: 03-government-bonds


### T-Bill with 180 days to maturity, discount rate 3.5%. Price per $1M face?

- [✓] A: $982,500

- [ ] B: $965,000

- [ ] C: $990,000

- [ ] D: $1,000,000


**Answer:** A

Price = 1,000,000 × (1 - 0.035 × 180/360) = 1,000,000 × 0.9825 = $982,500


### Which Treasury type pays semi-annual coupon and has 10-year maturity?

- [ ] A: T-Bill

- [✓] B: T-Note

- [ ] C: T-Bond

- [ ] D: STRIPS


**Answer:** B

T-Notes: 2-10yr, semi-annual coupon. T-Bills ≤1yr zero. T-Bonds 20-30yr. STRIPS are zero-coupon.


### On-the-run Treasury yield is typically ___ off-the-run Treasury yield.

- [ ] A: higher than

- [✓] B: lower than

- [ ] C: equal to

- [ ] D: unrelated to


**Answer:** B

On-the-run most liquid → investors accept lower yield (higher price). Off-the-run less liquid → higher yield compensation.


### How many STRIPS securities can be created from one 10yr Treasury with 4% semi-annual coupon?

- [ ] A: 1

- [ ] B: 10

- [ ] C: 20

- [✓] D: 21


**Answer:** D

20 semi-annual coupons + 1 principal repayment = 21 separate zero-coupon securities.


### STRIPS appeal to investors seeking:

- [ ] A: Maximum current income

- [ ] B: Inflation protection

- [✓] C: Known future value with no reinvestment risk

- [ ] D: Short-term liquidity


**Answer:** C

STRIPS = zero-coupon → known maturity value. No coupon reinvestment risk. Price volatile (long duration).


### Fannie Mae bonds yield more than Treasuries because:

- [ ] A: Longer maturity

- [✓] B: Credit risk premium (no explicit government guarantee)

- [ ] C: Higher coupon rate

- [ ] D: Lower liquidity only


**Answer:** B

Agencies have implicit but not explicit government backing → credit premium over Treasuries. Also liquidity premium.


### Private bank client asks: why does 10yr Treasury yield affect my corporate bond portfolio?

- [ ] A: It doesn't

- [✓] B: Corporate bonds priced as spread over Treasury benchmark

- [ ] C: Treasury yields are unrelated to corporate credit

- [ ] D: Only stock market affects corporate bonds


**Answer:** B

Corporate bond yield = Treasury benchmark + credit spread. Treasury move directly impacts corporate yields even if spread unchanged.


### Client calls: 'my TIPS principal adjusted up 2% with CPI. Did I earn 2%?'

- [ ] A: Yes, 2% total return

- [✓] B: No, total return = coupon + inflation adjustment. Nominal return includes both

- [ ] C: Only if held in taxable account

- [ ] D: TIPS don't pay coupons


**Answer:** B

TIPS total return = real coupon + inflation adjustment to principal. The 2% CPI adjustment is part of return, not total return.


### Which is NOT a risk for Treasury bond investors?

- [ ] A: Interest rate risk

- [ ] B: Reinvestment risk

- [✓] C: Credit default risk

- [ ] D: Inflation risk


**Answer:** C

Treasuries considered free of credit/default risk (full faith of US govt). Interest rate, reinvestment, and inflation risks remain.


### Bond equivalent yield of 180-day T-Bill priced at $980,000 per $1M face?

- [ ] A: 3.50%

- [✓] B: 4.08%

- [ ] C: 2.00%

- [ ] D: 4.00%


**Answer:** B

BEY = (1,000,000-980,000)/980,000 × 365/180 = 20,000/980,000 × 2.028 = 2.04% × 2.028 = 4.08%


---

# Module 4: Corporate Bonds

Est. study time: 2.5h

## Learning Objectives
- Distinguish investment grade vs high yield
- Interpret credit ratings from S&P, Moody's, Fitch
- Explain bond covenants and their purpose
- Understand seniority, recovery rates, and capital structure
- Calculate credit spreads

---

## Core Content

### Investment grade vs high yield

| Category | S&P | Moody's | Fitch | Characteristics |
|----------|-----|---------|-------|-----------------|
| **Investment Grade** | AAA to BBB- | Aaa to Baa3 | AAA to BBB- | Low default risk, institutional buyers |
| **High Yield (Junk)** | BB+ to D | Ba1 to C | BB+ to D | Higher yield, higher risk, limited buyers |
| **Default** | D | C | D | Payment missed |

### Credit ratings

Three major agencies: S&P Global, Moody's, Fitch.

Rating factors:
- Business risk: industry, competitive position, diversification
- Financial risk: leverage, coverage ratios, liquidity
- Management: strategy, governance, track record
- Country/regulatory: legal environment, sovereign rating ceiling

Rating watch vs outlook:
- **Outlook**: 6-24 month direction (positive/negative/stable)
- **Watch**: near-term possible change (within 90 days)

### Bond covenants

**Affirmative covenants**: things issuer must do (pay interest, maintain insurance).

**Negative covenants**: things issuer cannot do (incur more debt, sell assets, pay dividends beyond limit).

Protection for bondholders. Stronger in high yield.

### Seniority & capital structure

| Priority | Security | Risk | Recovery |
|----------|----------|------|----------|
| 1 | Senior secured | Lowest | 60-80% |
| 2 | Senior unsecured | | 40-60% |
| 3 | Senior subordinated | | 20-40% |
| 4 | Subordinated | | 10-30% |
| 5 | Junior subordinated | Highest | 0-10% |

Lower priority = higher yield.

### Credit spread

```
Credit spread = Bond yield - Treasury yield of same maturity
```

Drivers:
- Credit quality (rating)
- Liquidity
- Maturity
- Market risk appetite
- Economic cycle

Spread widens in recession, narrows in expansion.

Question: Spread widens even though company fundamentals unchanged — why? Answer: Market risk aversion (investors demand higher premium for bearing any risk). This is why credit spreads are called "risk premium" not just "default premium."

### Default & recovery

Historical default rates (1970-2023):
- AAA: ~0% annual
- AA: ~0.02% annual
- A: ~0.05% annual
- BBB: ~0.2% annual
- BB: ~0.8% annual
- B: ~2.5% annual
- CCC: ~12% annual

IG (BBB+ and above): ~0.1% annual. HY: ~2-4% annual (varies with cycle).

Recovery rate: % of face value recovered after default.
- Senior secured: ~50-70%
- Senior unsecured: ~30-50%
- Subordinated: ~10-30%

### Make-whole call

Most IG corporates have make-whole call provision.
If issuer calls early, pays bondholder PV of remaining coupons + principal.
Makes early call expensive for issuer → de facto non-callable.

---

## Examples

### Example 1: Credit spread interpretation

5yr Apple bond yields 4.50%. 5yr Treasury yields 4.20%.

Spread = 4.50% - 4.20% = 30bp.

Apple's spread reflects its AA rating, strong liquidity, tech industry position.

### Example 2: High yield scenario

Client asks about 7% yielding bond from CCC-rated retailer. During recession:

- Retail earnings fall → leverage rises → downgrade risk
- Spread widens (risk aversion increases)
- Bond price falls more than IG
- Recovery if default? Senior unsecured → ~40%

### Example 3: Private bank context

Client holds $2M of BBB-rated telecom bonds. Upgrade to A- happens.
- Spread tightens (less credit risk)
- Price rises
- Bond now eligible for more institutional mandates
- Client benefits from price appreciation + tighter yield

---

## Common Misconception

"IG bonds won't default." BBB-rated bonds default ~0.2%/yr — rare but real. "Fallen angels" (IG→HY) happen during stress (2008 saw 10% of IG universe downgraded to HY).

## Key Takeaways
- IG (BBB-/Baa3+) vs HY (BB+/Ba1+): default risk spectrum
- Ratings reflect business + financial risk profile
- Covenants protect bondholders — stronger in HY
- Seniority determines recovery in default
- Credit spread = risk premium over Treasuries
- Make-whole call: expensive early redemption

---

## Feynman Explain
Explain credit ratings to a private banking client. "Why does an A-rated bond yield less than a BB-rated bond?" Use simple risk analogy — lending money to different people.

*Self-check: Can you explain why a bond's spread might widen even without a downgrade?*

Run: `./scripts/learn.sh explain fixed-income 04-corporate-bonds`

---

## Reframe
Critique credit ratings: "Are ratings useful or harmful?" Consider: rating agencies' conflicts of interest (issuer-pays model), rating lag (downgrade after crisis), and herding behavior. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 04-corporate-bonds`

## Quiz: 04-corporate-bonds


### Baa3 rating from Moody's corresponds to which S&amp;P rating?

- [✓] A: BBB-

- [ ] B: BB+

- [ ] C: BBB+

- [ ] D: AA-


**Answer:** A

Baa3 (Moody's) = BBB- (S&amp;P). Both lowest IG tier.


### Minimum IG rating in S&amp;P scale?

- [ ] A: A-

- [✓] B: BBB-

- [ ] C: BB+

- [ ] D: BBB+


**Answer:** B

BBB- = lowest IG. BB+ and below = high yield.


### Which covenant prevents issuer from taking additional secured debt?

- [ ] A: Affirmative covenant

- [✓] B: Negative pledge covenant

- [ ] C: Cross-default covenant

- [ ] D: Dividend restriction


**Answer:** B

Negative pledge: issuer cannot pledge assets as collateral for new debt without equally securing existing bondholders.


### Recovery expectation for senior unsecured bond in default?

- [ ] A: 70-80%

- [✓] B: 30-50%

- [ ] C: 0-10%

- [ ] D: 100%


**Answer:** B

Senior unsecured typically recovers 30-50% of face. Senior secured higher (collateral), subordinated lower.


### Credit spread widens. Which macro condition likely caused it?

- [ ] A: Strong GDP growth

- [✓] B: Recession fears

- [ ] C: Fed cutting rates

- [ ] D: Stable inflation


**Answer:** B

Recession fears → risk aversion → investors demand higher premium for credit risk → spreads widen.


### Corporate bond yields 6.5%, Treasury yields 4.2%. Credit spread?

- [ ] A: 1.3%

- [✓] B: 2.3%

- [ ] C: 4.2%

- [ ] D: 6.5%


**Answer:** B

6.5% - 4.2% = 2.3% = 230bp. Spread reflects credit + liquidity premium.


### Private bank client: 'Why did my IG bond fund lose value even though no bonds defaulted?'

- [ ] A: Bond fund fees increased

- [✓] B: Credit spreads widened due to market stress

- [ ] C: Coupon rate decreased

- [ ] D: Maturity shortened


**Answer:** B

Spread widening = higher yield = lower price, even without defaults. Common in market stress.


### Make-whole call provision means issuer:

- [ ] A: Can call bond at par anytime

- [✓] B: Must pay PV of remaining cash flows if called early

- [ ] C: Cannot call bond ever

- [ ] D: Must replace with new issue at same rate


**Answer:** B

Make-whole: issuer pays PV of remaining coupons + principal at Treasury rate + spread. Expensive for issuer.


### Bond downgraded from BBB- to BB+. Immediate effect?

- [✓] A: Price likely falls (many IG mandates forced to sell)

- [ ] B: Price rises (higher yield attractive)

- [ ] C: No change

- [ ] D: Bond is called


**Answer:** A

Fallen angel: forced selling by IG-only mandates → price drops. Often overshoots → opportunity for HY buyers.


### Which capital structure tier has highest recovery in bankruptcy?

- [ ] A: Subordinated debentures

- [✓] B: Senior secured notes

- [ ] C: Preferred stock

- [ ] D: Junior subordinated notes


**Answer:** B

Senior secured = first claim on collateral assets. Highest recovery. Subordinated = last among bonds.


---

# Module 5: Municipal Bonds

Est. study time: 1.5h

## Learning Objectives
- Distinguish general obligation vs revenue bonds
- Understand tax-exempt status and tax-equivalent yield
- Describe muni market structure and participants
- Compare muni credit quality to corporate bonds

---

## Core Content

### What are municipal bonds?

Debt issued by states, cities, counties, and special districts.

Two main types:

| Type | Backing | Risk | Examples |
|------|---------|------|----------|
| **General Obligation (GO)** | Full faith & credit, taxing power | Lowest muni risk | State GO, city GO |
| **Revenue** | Specific revenue stream (tolls, fees, rents) | Higher than GO | Toll road, water, airport |

### Tax treatment

Key feature: interest exempt from federal income tax.

Why exempt? Constitutional doctrine of intergovernmental tax immunity (states/feds can't tax each other's debt). Also policy: lower borrowing cost for public infrastructure.

Also exempt from state/local tax if investor lives in issuing state.

Tax-equivalent yield (TEY):
```
TEY = Tax-exempt yield / (1 - marginal tax rate)
```

Example: Muni yields 3.5%, investor in 37% federal bracket.
```
TEY = 3.5% / (1 - 0.37) = 3.5% / 0.63 = 5.56%
```
Tax-equivalent yield ~5.56% — competitive with taxable bonds.

Question: At what tax bracket does muni become better than corporate of same risk? Answer: Breakeven bracket = 1 - (muni_yield / corporate_yield). If muni=3.5%, corporate=5%, breakeven=30%. Above 30%, muni wins after-tax.

### Alternative Minimum Tax (AMT)

Some munis subject to AMT (private activity bonds).
Tax-exempt for regular tax, but taxable under AMT.
Important for high-income clients subject to AMT.

### Muni market structure

- ~$4 trillion market
- Mostly retail and institutional buy-and-hold
- Less liquid than corporates
- Many small, infrequent issuers
- Trades OTC, often via electronic platforms (Electronic Municipal Market Access - EMMA)

### Credit quality

Historically high. Defaults rare vs corporates.

Muni 10-year cumulative default rate: ~0.1% for A-rated, ~0.5% for BBB-rated (vs corporate ~0.5% and ~2.5% respectively). GO defaults virtually zero for general-purpose states. Revenue bonds (healthcare, housing, industrial development) have higher default rates comparable to HY corporates.

Muni defaults concentrated in:
- Revenue bonds (especially healthcare, housing)
- Small issuers with weak economies
- Puerto Rico (sovereign-like, not US state bankruptcy)

Ratings approach differs: cash flow focus vs corporate balance sheet focus.

### Insured munis

Bond insurance (e.g., Assured Guaranty, Build America Mutual) wraps bond with insurer's credit.

AAA-rated insurer backs bond → bond rated AAA.

Insurance value eroded after 2008 (monoline insurers weakened).

### Build America Bonds (BABs)

2009-2010 program: taxable munis with federal subsidy.

Issued during financial crisis. Higher yields attracted institutional demand.

---

## Examples

### Example 1: Private bank tax-equivalent yield

Client in 32% bracket. Muni yields 4.2%.

TEY = 4.2% / (1 - 0.32) = 4.2% / 0.68 = 6.18%

Comparable corporate would need to yield >6.18% to be better after-tax.

### Example 2: GO vs revenue

City issues GO bond backed by property tax. Also issues revenue bond for airport.

Rating: GO = AA, airport revenue = A. Revenue bond higher yield due to lower security.

During pandemic: GO stable (property tax collected). Airport revenue fell sharply (travel dropped), spread widened.

---

## Common Misconception

"All munis are tax-free." Private activity bonds (airports, stadiums, housing) may trigger AMT. Out-of-state munis taxed at state level. Some munis (BABs) are taxable.

## Key Takeaways
- GO bonds: full faith & credit. Revenue: specific project revenue
- Muni interest federally tax-exempt. TEY calculation for comparison
- Market less liquid than corporates. Mostly buy-and-hold
- Default rare for GO. Revenue bonds have more risk
- Bond insurance wraps credit but insurer risk matters
- Private bank clients: tax-exempt yield often beats taxable after-tax

---

## Feynman Explain
Explain tax-equivalent yield to a client. "Why would you accept 4% tax-free from a muni instead of 6% taxable from a corporate?" Use take-home pay analogy.

*Self-check: Can you explain why high-net-worth clients tilt portfolios toward munis? What tax bracket makes munis attractive?*

Run: `./scripts/learn.sh explain fixed-income 05-municipal-bonds`

---

## Reframe
Critique tax-exempt munis: "Do munis benefit wealthy investors at public expense?" Consider: federal tax expenditure, market efficiency, and who holds munis. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 05-municipal-bonds`

## Quiz: 05-municipal-bonds


### General obligation bonds are backed by:

- [ ] A: Specific project revenue only

- [✓] B: Issuer's full taxing power and credit

- [ ] C: Federal government guarantee

- [ ] D: Bank letter of credit


**Answer:** B

GO bonds = full faith &amp; credit, backed by issuer's taxing authority. Revenue bonds backed by specific project cash flows.


### Muni yield 3.8%, investor marginal tax rate 30%. Tax-equivalent yield?

- [ ] A: 4.94%

- [✓] B: 5.43%

- [ ] C: 3.80%

- [ ] D: 4.56%


**Answer:** B

TEY = 3.8% / (1 - 0.30) = 3.8% / 0.70 = 5.43%


### Which is generally true about muni bond liquidity vs corporate bonds?

- [ ] A: Munis more liquid than corporates

- [✓] B: Munis less liquid than corporates

- [ ] C: Equal liquidity

- [ ] D: Munis trade on exchange, corporates OTC


**Answer:** B

Muni market = many small/single-state issuers, fewer trades, less transparency. Less liquid than corporates.


### Private activity bond interest may be subject to:

- [ ] A: State tax only

- [✓] B: Alternative Minimum Tax

- [ ] C: Social Security tax

- [ ] D: Sales tax


**Answer:** B

Private activity bonds (airports, housing, student loans) are AMT-preferenced. Interest taxable under AMT.


### Muni bond insurance:

- [ ] A: Eliminates all default risk

- [✓] B: Guarantees timely payment of principal and interest

- [ ] C: Protects against interest rate risk

- [ ] D: Is required by law for all munis


**Answer:** B

Insurance wraps bond with insurer's guarantee. Bond rating = insurer rating. But insurer can be downgraded (post-2008).


### Client in 35% federal bracket, state tax 5%. In-state muni yields 3.5%. TEY?

- [ ] A: 5.38%

- [ ] B: 3.50%

- [✓] C: 5.83%

- [ ] D: 4.50%


**Answer:** C

Muni exempt from federal + state (in-state). Combined rate = 1 - (1-0.35)(1-0.05) = 1 - 0.6175 = 38.25%. TEY = 3.5% / 0.6175 = 5.67%. Closest: 5.83% if state fully deductible on federal.


### Historically, most muni defaults occur in which type?

- [ ] A: State GO bonds

- [ ] B: AAA-rated insured bonds

- [✓] C: Revenue bonds (healthcare, housing)

- [ ] D: Treasury-backed bonds


**Answer:** C

Revenue bonds (especially healthcare, housing, industrial development) have higher default rates than GO bonds.


### Build America Bonds were:

- [ ] A: Tax-exempt munis for infrastructure

- [✓] B: Taxable munis with federal subsidy to issuer

- [ ] C: Corporate bonds for construction

- [ ] D: Treasury inflation-protected securities


**Answer:** B

BABs (2009-10): taxable munis. Federal govt paid 35% of coupon to issuer. Attracted pension/401k demand.


### Private bank client in 24% bracket. Muni yields 3.2%. Corporate of similar risk yields 4.5%. Which is better after-tax?

- [ ] A: Muni (TEY = 4.21% &gt; 4.5%? No)

- [✓] B: Corporate (after-tax = 4.5% × 0.76 = 3.42% &gt; 3.2%)

- [ ] C: Equal

- [ ] D: Cannot determine


**Answer:** B

Corporate after-tax = 4.5% × (1-0.24) = 3.42%. Muni = 3.2%. Corporate better at this bracket. Muni advantage grows with bracket.


### GO bond rating analysis focuses primarily on:

- [ ] A: Project revenue projections

- [✓] B: Tax base, economic conditions, debt burden, budget management

- [ ] C: Corporate balance sheet

- [ ] D: Toll road traffic projections


**Answer:** B

GO analysis: economy, tax base diversity, debt metrics, budgetary discipline, pension obligations. Revenue analysis: project cash flows.


---

# Module 6: MBS & ABS

Est. study time: 2.5h

## Learning Objectives
- Explain mortgage pass-through mechanics
- Understand prepayment risk and CPR/PSA
- Describe CMO structure and tranches
- Distinguish ABS from MBS
- Analyze senior/subordinate structures

---

## Core Content

### Securitization process

Originator (bank) pools loans → sells to SPV → SPV issues securities.

Key players:
- **Originator**: originates mortgages/loans
- **SPV (Special Purpose Vehicle)**: bankruptcy-remote entity
- **Servicer**: collects payments, handles delinquencies
- **Trustee**: oversees cash flow distribution
- **Rating agency**: assigns credit ratings to tranches

### Mortgage pass-through

Agency MBS (Fannie Mae, Freddie Mac, Ginnie Mae):
- Ginnie Mae: explicit US government guarantee
- Fannie/Freddie: implicit guarantee (but now under conservatorship)
- Pass through monthly payments (interest + principal)

Monthly cash flow = scheduled principal + interest + prepayments.

### Prepayment risk

Borrowers can prepay mortgages anytime (US). This creates uncertainty.

Why US-only? Most countries have prepayment penalties or fixed-rate mortgages that don't prepay easily. US has non-recourse, no-penalty prepayment — unique globally.

Prepayment speed measures:
- **CPR** (Conditional Prepayment Rate): annualized prepayment rate
- **PSA** (Public Securities Association): benchmark curve
- **SMM** (Single Monthly Mortality): monthly prepayment rate

```
SMM = 1 - (1 - CPR)^(1/12)
```

Question: What happens to MBS price when rates rise? Answer: Prepayment slows (extension risk) → average life lengthens → duration extends. MBS has negative convexity: rates rise → duration rises (bad), rates fall → duration falls (also bad).

### CPR vs PSA

100% PSA = prepayment ramps up from 0.2% CPR at month 1 to 6% CPR at month 30, then stays at 6%.

How likely are different prepayment speeds? In normal rate environment, 100-200% PSA typical. During refinancing boom (2020-2021), speeds hit 300-400% PSA as rates hit record lows. In rising-rate environment, speeds can fall to 50% PSA or lower.

150% PSA = 1.5x the benchmark.

Drivers of prepayment:
- **Refinancing incentive**: mortgage rates drop → borrowers refinance
- **Housing turnover**: home sales → loan payoff
- **Seasonality**: summer/spring higher
- **Burnout**: prepayment slows over time (rate-sensitive borrowers already left)

### CMO (Collateralized Mortgage Obligation)

CMO redistributes prepayment risk across tranches.

| Tranche | Priority | Prepayment risk | Average life |
|---------|----------|-----------------|--------------|
| **Sequential A** | First principal | Shortest | Shortest |
| **Sequential B** | After A | Medium | Medium |
| **Sequential C** | After B | Low | Long |
| **Z-Tranche (Accrual)** | Last | Lowest | Longest |

**IO (Interest Only)**: gets only interest. Price moves WITH rates (prepayment kills IO).
**PO (Principal Only)**: gets only principal. Price moves AGAINST rates (prepayment beneficial).

### Non-agency MBS

Private-label MBS (no government guarantee).

Credit enhancement:
- **Senior/subordinate structure**: senior tranches get paid first
- **Overcollateralization**: pool value > bonds issued
- **Excess spread**: interest from pool > bond coupons
- **Reserve accounts**: cash buffer for losses

### ABS overview

Asset-Backed Securities: non-mortgage collateral.

Common types:
| Type | Collateral | WAL | Prepayment |
|------|-----------|-----|------------|
| Credit card ABS | Receivables | 3-7yr | High, seasonal |
| Auto ABS | Car loans | 2-5yr | Moderate |
| Student loan ABS | Student debt | 5-15yr | Low |
| CLO | Leveraged loans | 5-12yr | Low (callable) |

### Cash flow waterfalls

Senior tranche gets paid first. Junior tranches absorb losses first.

Example:
1. Interest: pool cash → pay senior interest → pay mezzanine → pay subordinate
2. Principal: pool cash → pay senior principal → mezzanine → subordinate
3. Losses: absorbed by subordinate (first loss piece) → mezzanine → senior

---

## Examples

### Example 1: CPR calculation

MBS pool has SMM = 0.5% monthly. What is CPR?

CPR = 1 - (1 - 0.005)^12 = 1 - 0.994^12 = 1 - 0.9416 = 5.84%

### Example 2: Prepayment scenario

Rates drop 1%. MBS pool at 100% PSA (6% CPR) now likely moves to ~250% PSA (15% CPR).

Investor in pass-through gets principal back faster → must reinvest at lower rates (contraction risk).

CMO sequential A tranche gets hit first. Z-tranche unaffected until earlier tranches paid off.

### Example 3: Private bank context

Client holds agency MBS fund. Fed cuts rates → prepayments spike → fund duration shortens → yield declines.

Client asks: "Why did my MBS fund pay out so much principal this month?"

Answer: "Prepayments increased as homeowners refinance at lower rates. You received principal earlier — must reinvest at current lower yields."

---

## Common Misconception

"Agency MBS = risk-free." Credit risk near-zero (government backing), but prepayment risk is real. Negative convexity means MBS underperforms Treasuries in both rallies and selloffs.

## Key Takeaways
- Agency MBS: government-guaranteed. Non-agency: credit tranching
- Prepayment risk measured by CPR/PSA. Driven by rates, seasonality, burnout
- CMO redistributes prepayment risk into tranches
- IO: bet on rates rising. PO: bet on rates falling
- ABS: diverse collateral. Senior/sub structure protects top tranches
- WAL not fixed — prepayment creates uncertainty

---

## Feynman Explain
Explain prepayment risk to a client: "Why does a mortgage bond lose value when rates fall?" Connect to what happened in 2020-2021 refinancing wave.

*Self-check: Can you explain why IO tranche price RISES when rates rise?*

Run: `./scripts/learn.sh explain fixed-income 06-mbs-and-abs`

---

## Reframe
Critique securitization: "Is securitization good or bad for financial stability?" Consider 2008 crisis versus benefits of credit access. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 06-mbs-and-abs`

## Quiz: 06-mbs-and-abs


### Agency MBS are backed by:

- [ ] A: Corporate credit

- [✓] B: Mortgage pools guaranteed by Fannie/Freddie/Ginnie

- [ ] C: Auto loans

- [ ] D: Municipal revenue


**Answer:** B

Agency MBS = mortgages securitized by Ginnie Mae (explicit govt guarantee) or Fannie/Freddie (implicit).


### SMM = 1%. What is approximate CPR?

- [ ] A: 6%

- [✓] B: 11.4%

- [ ] C: 12%

- [ ] D: 1%


**Answer:** B

CPR = 1 - (1-0.01)^12 = 1 - 0.99^12 = 1 - 0.8864 = 11.36%. ~11.4%


### What happens to agency MBS prepayment when mortgage rates fall 1%?

- [ ] A: Prepayment decreases

- [✓] B: Prepayment increases significantly

- [ ] C: No effect

- [ ] D: Prepayment stops


**Answer:** B

Rate drop → refinancing wave → prepayment spikes. More borrowers refinance to lower rate.


### In CMO sequential pay structure, which tranche receives principal first?

- [ ] A: Z-tranche

- [✓] B: Sequential A

- [ ] C: IO tranche

- [ ] D: Sequential C


**Answer:** B

Sequential A receives all principal until fully paid, then B, then C, then Z. A has shortest average life.


### IO (Interest Only) tranche value is hurt most by:

- [ ] A: Rising interest rates

- [✓] B: Fast prepayments

- [ ] C: Falling rates

- [ ] D: Extension risk


**Answer:** B

Prepayment reduces outstanding principal → less interest paid to IO. Fast prepayment kills IO cash flows.


### In senior/subordinate ABS structure, losses are absorbed first by:

- [ ] A: Senior tranche

- [✓] B: Subordinate (first loss) tranche

- [ ] C: All tranches equally

- [ ] D: Servicer


**Answer:** B

Subordinate tranche absorbs first losses. This protects senior tranche from default losses up to subordination level.


### Prepayment burnout means:

- [ ] A: Prepayment speeds accelerate over time

- [✓] B: Prepayment slows as rate-sensitive borrowers have already refinanced

- [ ] C: Prepayment is constant

- [ ] D: Borrowers stop paying mortgages


**Answer:** B

Burnout: after refinancing wave, remaining borrowers are less rate-sensitive → prepayment slows even if rates stay low.


### Private bank client's MBS fund duration shortened unexpectedly. Likely cause?

- [ ] A: Rates rose sharply

- [✓] B: Prepayments increased (refinancing wave)

- [ ] C: Defaults increased

- [ ] D: Fund manager sold long bonds


**Answer:** B

Prepayments return principal faster → shorter average life → shorter duration. Contraction risk for MBS investors.


### Which ABS type typically has the longest weighted average life?

- [ ] A: Credit card ABS

- [ ] B: Auto ABS

- [✓] C: Student loan ABS

- [ ] D: CLO


**Answer:** C

Student loans: long amortization (10-30yr), low prepayment → long WAL. Credit card: short revolving period. Auto: 3-7yr.


### Contraction risk in MBS refers to:

- [ ] A: Default risk increasing

- [✓] B: Prepayment shortens bond life when rates fall

- [ ] C: Extension of bond life when rates rise

- [ ] D: Collateral pool shrinking due to credit losses


**Answer:** B

Contraction risk: rates fall → prepayments rise → bond pays off early → reinvest at lower rates. Extension risk is opposite.


---

# Module 7: Repo & Reverse Repo

Est. study time: 2h

## Learning Objectives
- Explain repo mechanics and purpose
- Distinguish repo from reverse repo
- Understand haircut and margin
- Describe GC vs special repo
- Analyze repo market role in funding and leverage

---

## Core Content

### What is repo?

**Repurchase agreement**: sell security today with agreement to buy back at future date at higher price.

Economically: collateralized short-term loan.

```
Day 1: Borrower sells bond → receives cash
Day T: Borrower repurchases bond → pays cash + interest
```

Interest = repo rate.

### Repo vs Reverse repo

| Party | Action |
|-------|--------|
| **Borrower** (in repo) | Sells bond today, repurchases later. Receives cash. Pays repo rate |
| **Lender** (in reverse repo) | Buys bond today, sells later. Lends cash. Earns repo rate |

They are the same trade viewed from opposite sides.

### Mechanics

```
Accrued interest adjusted:
Start: Cash = Bond price + accrued interest
End: Cash_back = Start_cash × (1 + repo_rate × days/360)
```

Collateral: Treasuries (most common), agencies, MBS, corporates.

### Haircut (initial margin)

```
Haircut = (Collateral value - Cash lent) / Collateral value
```

Protects lender from collateral price decline.

Why different haircuts by asset? Higher volatility → larger potential price gap between margin calls → more protection needed. Treasury barely moves intraday; HY bond can gap 5% on earnings miss.

| Collateral | Typical Haircut |
|------------|-----------------|
| Treasury | 0.5-2% |
| Agency MBS | 2-5% |
| IG corporate | 5-10% |
| HY corporate | 10-20% |
| Equities | 10-50% |

Higher volatility → higher haircut.

### GC vs Special repo

| Type | Collateral | Rate | Notes |
|------|------------|------|-------|
| **General Collateral (GC)** | Any Treasury | Lowest | Interbank funding |
| **Special** | Specific security | Below GC | Short-seller needs specific bond |
| **Fails** | None | Highest | Failed delivery penalty |

Special rate can go negative (short squeeze).

### Market participants

| Participant | Role |
|-------------|------|
| Money market funds | Lend cash (reverse repo) |
| Hedge funds | Borrow cash to lever, borrow bonds to short |
| Primary dealers | Intermediaries |
| Central bank (Fed RRP) | Set floor on overnight rates |
| Pension/insurance | Lend bonds for extra yield |

### Uses of repo

1. **Leverage**: hedge fund posts $10M cash, borrows $90M in repo → controls $100M bond position
2. **Short selling**: borrow specific bond to sell short (reverse repo)
3. **Inventory funding**: dealers fund bond inventory via repo
4. **Cash management**: money funds earn return on excess cash

### Tri-party repo

Intermediary (BNY Mellon / JPMorgan) handles collateral valuation, margin calls, settlement.

Reduces operational burden. Dominant form of US repo.

### Repo market stress

2008: haircuts spiked → repo lenders withdrew → forced selling → crisis amplified.

2019: repo rates spiked to 10% (reserves shortage, quarter-end constraints).

How likely? Repo stress events are rare but systemic — ~1-2 major events per decade. SOFR spiked above 5% only 3 times in 2020-2025. Quarter-end spikes more common (~monthly pattern of 10-50bp).

Secured Overnight Financing Rate (SOFR): benchmark replacing LIBOR.

Question: Repo is collateralized — why was it a problem in 2008? Answer: Collateral was MBS whose value crashed. Lenders demanded higher haircuts → forced selling → more price drops → higher haircuts. Liquidity spiral.

---

## Examples

### Example 1: Basic repo calculation

Dealer repo $100M Treasuries for 7 days at 4.5%.

Start cash = $100M (ignoring accrued for simplicity)

End cash = $100M × (1 + 0.045 × 7/360) = $100M × 1.000875 = $100,087,500

Repo interest = $87,500

### Example 2: Haircut

Hedge fund buys $100M corporate bonds. Posts $10M equity, borrows $90M in repo.

Haircut = (100M - 90M) / 100M = 10%

If bond price falls to $95M → margin call (equity < haircut × new collateral value).

### Example 3: Private bank context

Client's fund uses repo to lever MBS portfolio.

Treasury repo rate = 4.25%. Fund earns 5.50% on MBS.

Net carry = 5.50% - 4.25% = 1.25% on borrowed amount.

Leverage magnifies return: $10M equity + $40M repo = $50M MBS → net return = [50×5.5% - 40×4.25%] / 10 = [2.75 - 1.70] / 10 = 10.5% equity return (vs 5.5% unlevered).

But leverage magnifies losses too.

---

## Common Misconception

"Repo is collateralized so no risk." Counterparty risk exists if collateral drops suddenly (2008 MBS). Also operational risk (2019 settlement fails). Haircut protects but isn't perfect.

## Key Takeaways
- Repo = collateralized short-term loan. Reverse repo = lending cash
- Haircut protects lender. Higher volatility → higher haircut
- GC: general funding. Special: specific security demand
- Repo enables leverage, short selling, dealer inventory funding
- Tri-party repo dominates (third-party agent)
- SOFR replaced LIBOR as overnight reference rate
- Repo stress = systemic risk (2008, 2019)

---

## Feynman Explain
Explain repo to a colleague: "How does a hedge fund buy $100M of bonds with only $10M?" Use mortgage analogy (house down payment = haircut).

*Self-check: Can you explain why special repo rates can go below GC?*

Run: `./scripts/learn.sh explain fixed-income 07-repo-and-reverse-repo`

---

## Reframe
Critique repo market: "Is repo market stable or fragile?" Consider 2008 freeze and 2019 spike. What reforms helped? (CCP clearing, higher haircuts, Fed RRP facility.) Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 07-repo-and-reverse-repo`

## Quiz: 07-repo-and-reverse-repo


### In a repo transaction, the borrower:

- [✓] A: Receives cash and delivers collateral

- [ ] B: Lends cash and receives collateral

- [ ] C: Buys a bond outright

- [ ] D: Issues new debt


**Answer:** A

Repo borrower sells security today (delivers collateral), receives cash, repurchases later at higher price.


### Haircut of 5% on $50M collateral means cash lent is:

- [ ] A: $50M

- [✓] B: $47.5M

- [ ] C: $52.5M

- [ ] D: $45M


**Answer:** B

Haircut = (collateral - cash) / collateral. Cash = 50M × (1-0.05) = $47.5M.


### Special repo rate below GC rate indicates:

- [ ] A: General funding shortage

- [✓] B: Specific security in high demand (short sellers)

- [ ] C: Central bank intervention

- [ ] D: Market stress


**Answer:** B

Special rate: short-sellers need specific bond → lend cash at below-GC rate to borrow that bond.


### Which typically has the HIGHEST repo haircut?

- [ ] A: Treasuries

- [ ] B: Agency MBS

- [✓] C: High yield corporate bonds

- [ ] D: TIPS


**Answer:** C

HY corporates: higher price volatility, lower liquidity → higher haircut (10-20%). Treasuries: lowest (0.5-2%).


### Tri-party repo involves:

- [ ] A: Three bond issuers

- [✓] B: Third-party agent managing collateral and settlement

- [ ] C: Three different currencies

- [ ] D: Central bank, dealer, hedge fund


**Answer:** B

Tri-party: bank (BNY/JPM) handles collateral valuation, margin, settlement. Reduces operational friction.


### A 10% haircut on $200M collateral position means borrower puts up how much equity?

- [✓] A: $20M

- [ ] B: $10M

- [ ] C: $30M

- [ ] D: $200M


**Answer:** A

Borrower equity = collateral × haircut = $200M × 10% = $20M. Borrows $180M, puts up $20M.


### Collateral value falls below loan amount. What happens?

- [ ] A: Nothing — repo is fixed

- [✓] B: Margin call: borrower must post additional collateral or cash

- [ ] C: Loan is forgiven

- [ ] D: Lender keeps collateral


**Answer:** B

Repo marked to market daily. Collateral decline → margin call. Borrower adds cash/securities or faces default.


### Hedge fund borrows $80M in repo against $100M collateral. Haircut?

- [ ] A: 10%

- [✓] B: 20%

- [ ] C: 25%

- [ ] D: 80%


**Answer:** B

Haircut = (100-80)/100 = 20%. Fund puts up $20M equity.


### Private bank client: 'My bond fund repo financing cost rose suddenly.' Most likely?

- [ ] A: Fed cut rates

- [✓] B: GC repo rate spiked due to quarter-end reserve shortage

- [ ] C: Bond fund credit rating improved

- [ ] D: Collateral value increased


**Answer:** B

Quarter-end: bank balance sheet constraints → repo rates spike (e.g., 2019 repo spike). GC rate directly impacts financing cost.


### SOFR replaced LIBOR as repo benchmark because:

- [✓] A: SOFR is based on actual repo transactions (not estimated)

- [ ] B: SOFR is higher than LIBOR

- [ ] C: LIBOR was too volatile

- [ ] D: SOFR includes unsecured lending


**Answer:** A

SOFR = Secured Overnight Financing Rate. Based on actual Treasury repo transactions. LIBOR was estimated and manipulation-prone.


---

# Module 8: Yield Curve Analysis

Est. study time: 3h

## Learning Objectives
- Interpret yield curve shapes
- Explain expectations, liquidity preference, and market segmentation theories
- Calculate forward rates from spot rates
- Understand curve steepening/flattening
- Analyze curve as economic indicator

---

## Core Content

### What is yield curve?

Graph of yields vs maturity (usually Treasuries).

Normal shape: upward sloping (longer maturity = higher yield).

### Curve shapes

| Shape | Description | Signal |
|-------|-------------|--------|
| **Normal** | Upward sloping | Growth expected, term premium |
| **Flat** | Short = long yields | Transition phase |
| **Inverted** | Downward sloping | Recession expected (short > long) |
| **Humped** | Rise then fall | Mid-term uncertainty |

Inverted curve = strongest recession predictor (past 8 US recessions preceded by inversion).

How often does inversion happen? ~15% of months since 1960s. Typical inversion lasts 6-18 months. Lead time to recession: 6-24 months (average ~12 months). Not all inversions lead to recession (false positives: 1966, 1998 inverted briefly with no recession).

Question: If expectations theory alone explained curve, what shape would dominate? Answer: Flat (since expected future rates should be flat on average). Reality: upward-sloping most of time → term premium exists (liquidity preference).

### Three theories

**1. Expectations Theory**

Long-term yield = average of expected future short-term rates.

```
(1 + y_2)^2 = (1 + y_1)(1 + E[f_1])
```

Implies forward rates = expected future spot rates.

Limitation: ignores term premium. Predicts flat curve on average — wrong.

**2. Liquidity Preference Theory**

Investors demand premium for holding longer-term bonds.

Forward rate = expected future rate + liquidity premium.

Explains normal upward slope. Term premium increases with maturity.

**3. Market Segmentation Theory**

Different investors prefer different maturities:
- Money market funds: short end
- Pension/insurance: long end
- Supply/demand within each segment determines rates

**Preferred Habitat**: variation — investors prefer certain maturities but will switch if premium is enough.

### Forward rates

Forward rate = rate for future period implied by spot curve.

2yr spot = 4%, 1yr spot = 3.5%. 1yr forward rate 1yr from now:

```
(1.04)^2 = (1.035)(1 + f)
f = (1.04)^2 / 1.035 - 1 = 1.0816/1.035 - 1 = 4.50%
```

### Curve movements

| Movement | Description | Cause |
|----------|-------------|-------|
| **Parallel shift** | All yields change same amount | Broad rate move |
| **Steepening** | Long rates rise more or fall less than short | Growth expectations, inflation |
| **Flattening** | Short rates rise more or fall less than long | Tightening cycle |
| **Butterfly** | Curve curvature changes | Mid-term vs wings |

### Curve as economic indicator

- Inversion → recession 6-24 months later (reliable since 1960s)
- Steepening after inversion → recession imminent or recovery beginning
- Federal funds rate vs 10yr Treasury: most watched spread
- Curve steepness = proxy for growth + inflation expectations

### Swap curve

Interest rate swap curve complements Treasury curve.

- Treasuries: risk-free rate
- Swap curve: AA bank credit quality
- Swap spread = swap rate - Treasury rate (typically positive)

---

## Examples

### Example 1: Curve inversion

Jan 2023: 3-month T-Bill = 4.5%, 10yr Treasury = 3.5%.

Inversion = 4.5% - 3.5% = -100bp.

Signal: market expects economic slowdown → Fed will cut rates → long yields already falling in anticipation.

### Example 2: Steepener trade

Investor expects curve to steepen. Buys 30yr bond, shorts 2yr note.

If curve steepens: long bond price rises more or falls less than short position gains.

### Example 3: Private bank context

Client asks: "Should I extend duration now? Curve is flat."

Analysis: flat curve → little term premium. Extra yield for going 10yr vs 2yr is small. If recession comes, rates fall → longer bonds rally. Extension might pay off, but near-term volatility high.

---

## Common Misconception

"Inversion means recession tomorrow." Typical lead time 6-24 months. Curve can invert then re-steepen without recession (1966 false positive). Inversion signals higher recession probability, not certainty.

## Key Takeaways
- Normal = up. Inverted = down → recession signal
- Expectations theory: yield = avg of expected future rates
- Liquidity preference: term premium for longer bonds
- Segmentation: supply/demand in maturity silos
- Forward rates derived from spot curve
- Steepening/flattening = relative movement of short vs long
- Swap curve alternative benchmark

---

## Feynman Explain
Explain yield curve inversion to a client: "Why do long-term rates sometimes fall below short-term rates, and what does it mean?" Use simple economic story (growth expectations, Fed policy).

*Self-check: Can you explain why forward rates differ from expected future rates under liquidity preference theory?*

Run: `./scripts/learn.sh explain fixed-income 08-yield-curve-analysis`

---

## Reframe
Critique yield curve as recession predictor: "Has inversion become less reliable?" Consider QE, global demand for Treasuries, structural low rates. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 08-yield-curve-analysis`

## Quiz: 08-yield-curve-analysis


### Inverted yield curve means:

- [✓] A: Short-term yields &gt; long-term yields

- [ ] B: Long-term yields &gt; short-term yields

- [ ] C: All yields equal

- [ ] D: Yields are negative


**Answer:** A

Inverted: short rates &gt; long rates. Historically precedes recession.


### Expectations theory says 10yr yield = ?

- [✓] A: Average of expected future short rates over 10 years

- [ ] B: Current 10yr inflation

- [ ] C: Fed funds rate

- [ ] D: 10yr corporate yield


**Answer:** A

Long-term yield = average of expected future short-term rates over same period.


### Liquidity preference theory explains normal upward slope by:

- [ ] A: Supply/demand per maturity segment

- [✓] B: Investors require term premium for longer bonds

- [ ] C: Government issues more short-term debt

- [ ] D: Inflation expectations are constant


**Answer:** B

Investors prefer shorter bonds (no price risk). Must pay premium to hold longer bonds → upward slope.


### 1yr spot = 2%, 2yr spot = 3%. 1yr forward rate 1yr from now?

- [ ] A: 3.00%

- [✓] B: 4.01%

- [ ] C: 2.50%

- [ ] D: 5.00%


**Answer:** B

(1.03)^2 / (1.02) - 1 = 1.0609/1.02 - 1 = 1.0401 - 1 = 4.01%


### Curve steepening means:

- [ ] A: Long rates fall relative to short rates

- [✓] B: Long rates rise relative to short rates

- [ ] C: All rates move equally

- [ ] D: Curve inverts


**Answer:** B

Steepening: gap between long and short yields widens. Long up more / short down more.


### A flat yield curve most likely signals:

- [ ] A: Rapid economic growth

- [✓] B: Transition or uncertainty period

- [ ] C: Deflation

- [ ] D: Currency crisis


**Answer:** B

Flat curve = markets uncertain about direction. Often between normal and inversion. Transition phase.


### Private bank client sees 2yr = 4.5%, 10yr = 3.8%. What is this signal?

- [ ] A: Bullish for stocks — growth ahead

- [✓] B: Recession warning — yield curve inverted

- [ ] C: No signal

- [ ] D: Inflation accelerating


**Answer:** B

Inversion (2yr &gt; 10yr) = historically reliable recession indicator. Client should consider defensive positioning.


### Market segmentation theory says yield curve shape determined by:

- [ ] A: Expected future rates only

- [✓] B: Supply/demand within each maturity segment independently

- [ ] C: Term premium only

- [ ] D: Central bank policy only


**Answer:** B

Different investor types operate in different maturities. Supply/demand within each segment determines rates there.


### Swap spread is typically positive because:

- [ ] A: Swap rate &lt; Treasury rate

- [✓] B: Swap rate reflects AA bank credit, Treasury rate reflects risk-free

- [ ] C: Swaps have no counterparty risk

- [ ] D: Treasuries have credit risk


**Answer:** B

Swap spread = swap rate - Treasury rate. Positive because swap includes bank credit risk. Treasury = risk-free.


### Client: 'I'll lend for 5 years if I get 50bp more than rolling 3-month T-Bills.' Which theory explains this?

- [ ] A: Expectations theory

- [✓] B: Liquidity preference theory

- [ ] C: Market segmentation theory

- [ ] D: Modern portfolio theory


**Answer:** B

Liquidity premium: investor requires extra yield (term premium) to hold longer bond vs rolling short-term investments.


---

# Module 9: Duration

Est. study time: 3h

## Learning Objectives
- Calculate Macaulay duration
- Interpret modified duration as price sensitivity
- Calculate dollar duration and PVBP
- Understand key-rate duration for non-parallel shifts
- Measure portfolio duration

---

## Core Content

### Macaulay Duration

Weighted average time to receive cash flows (in years).

```
Macaulay D = Σ [t × PV(CF_t)] / Σ PV(CF_t)
```

Each cash flow weighted by its present value contribution.

Higher coupon → lower duration. Longer maturity → higher duration.

Zero-coupon bond: Macaulay duration = maturity.

Question: Why use duration instead of just maturity? Answer: Maturity ignores coupon timing. Two 10yr bonds — one 6% coupon, one zero-coupon — have same maturity but very different rate sensitivity. Duration captures this.

### Modified Duration

Price sensitivity to yield changes.

Why Macaulay → Modified? Macaulay in years is intuitive but not directly useful for P&L. Modified D converts to % price change per 1% yield move — practical for risk reporting, limits, hedging.

```
Modified D = Macaulay D / (1 + YTM / periods_per_year)
```

```
Price change ≈ -Modified D × Δyield × Price
```

Example: Modified D = 5.6, yield +0.5% (50bp).
P/L ≈ -5.6 × 0.005 × Price = -2.8%

Good approximation for small changes.

### Dollar duration

Dollar price change per 100bp yield change.

```
Dollar D = Modified D × Price
```

Used for hedging. Long bond → negative dollar duration (price falls when yield rises).

### PVBP (Price Value of a Basis Point)

Dollar price change per 1bp yield change.

```
PVBP = Dollar duration × 0.0001 (per $1 face) or Modified D × Price × 0.0001
```

Also called DV01 (Dollar Value of 01).

### Duration determinants

| Factor | Higher duration when... |
|--------|------------------------|
| **Maturity** | Longer maturity |
| **Coupon** | Lower coupon |
| **Yield** | Lower yield |
| **Payment frequency** | Less frequent |

Longest duration: long-maturity zero-coupon bonds.

### Key-rate duration

Sensitivity to yield change at specific maturity point.

Portfolio may have different sensitivity to 2yr vs 10yr moves.

Key-rate durations for 2yr, 5yr, 10yr, 30yr.

Sum of key-rate durations = modified duration.

Used for:
- Barbell vs bullet analysis
- Curve steepener/flattener hedging
- Relative value trades

### Portfolio duration

Weighted average of individual bond durations.

```
Portfolio D = Σ w_i × D_i
```

Limitation: assumes parallel shifts. Key-rate gives better picture.

### Limitations of duration

- **Linear approximation**: accurate for small moves only
- **Parallel shift assumption**: non-parallel shifts matter
- **Convexity ignored**: duration underestimates price rise, overestimates price fall
- **Spread duration**: corporate bonds have spread duration (sensitivity to credit spread)

---

## Examples

### Example 1: Macaulay duration calculation

2yr bond, 5% coupon annual, YTM 4%, face $1,000.

| Year | CF | PV @ 4% | PV × t |
|------|----|---------|--------|
| 1 | $50 | $48.08 | $48.08 |
| 2 | $1,050 | $970.87 | $1,941.74 |
| Total | | $1,018.95 | $1,989.82 |

Macaulay D = $1,989.82 / $1,018.95 = 1.95 years

Modified D = 1.95 / 1.04 = 1.88

If yield +1% → price ≈ -1.88 × 1% = -1.88% → new price ≈ $1,018.95 × 0.9812 = $999.80

### Example 2: PVBP

Bond price = $105, modified D = 4.5.

PVBP = 4.5 × $105 × 0.0001 = $0.04725 per $100 face.

For $1M face: PVBP = $0.04725 × 10,000 = $472.50 per bp.

Hedge: short Treasury futures. Notional needed = PVBP_portfolio / PVBP_futures.

### Example 3: Private bank context

Client holds $5M 10yr Treasuries, D = 8.5. Expects rates to rise 25bp.

Expected loss ≈ -8.5 × 0.0025 × $5M = -$106,250.

Advise: reduce duration (sell 10yr, buy 2yr) or hedge with futures/swap.

---

## Common Misconception

"Duration 5 = I get my money back in 5 years." No. Duration is weighted avg time of cash flows, not payback period. For coupon bond, duration < maturity because early coupons pull avg forward.

## Key Takeaways
- Macaulay D = weighted avg time to cash flows. Modified D = price sensitivity
- Dollar D / PVBP: hedging tools. 1bp = 0.01%
- Higher coupon → lower D. Longer maturity → higher D
- Key-rate D: sensitivity to specific maturities
- Portfolio D = weighted average (parallel shift assumption)
- Linear approximation only — breaks for large moves (need convexity)

---

## Feynman Explain
Explain duration to a colleague: "What does 'duration 7 years' really mean for a $1M bond position?" Connect to price change when rates move 1%.

*Self-check: Can you explain why a zero-coupon bond has higher duration than a coupon bond with same maturity?*

Run: `./scripts/learn.sh explain fixed-income 09-duration`

---

## Reframe
Critique duration as risk measure: "When does duration mislead?" Consider: bonds with embedded options (callable, MBS), very large rate moves, non-parallel curve shifts. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 09-duration`

## Quiz: 09-duration


### Macaulay duration of a zero-coupon bond equals:

- [ ] A: Half its maturity

- [✓] B: Its maturity

- [ ] C: Zero

- [ ] D: Its modified duration


**Answer:** B

Zero-coupon: single cash flow at maturity. Weighted avg time = maturity.


### Modified duration 6.5, yield +0.25%. Approximate price change?

- [ ] A: +1.63%

- [✓] B: -1.63%

- [ ] C: -0.16%

- [ ] D: +0.16%


**Answer:** B

ΔP ≈ -Modified D × Δyield = -6.5 × 0.0025 = -0.01625 = -1.63%


### Two bonds same maturity. Bond A: 5% coupon. Bond B: 2% coupon. Which has higher duration?

- [ ] A: Bond A

- [✓] B: Bond B

- [ ] C: Equal

- [ ] D: Cannot determine


**Answer:** B

Lower coupon → more weight on distant principal → higher duration. Bond B has higher duration.


### DV01 (PVBP) = $450. Yield +5bp. Approximate dollar loss?

- [ ] A: $450

- [ ] B: $900

- [✓] C: $2,250

- [ ] D: $90


**Answer:** C

$450 per bp × 5bp = $2,250


### Key-rate duration used for:

- [ ] A: Measuring credit risk

- [✓] B: Analyzing sensitivity to specific maturity points on curve

- [ ] C: Calculating YTM

- [ ] D: Measuring convexity


**Answer:** B

Key-rate D measures sensitivity to 1bp change at specific maturity (e.g., 2yr, 10yr). Useful for non-parallel shifts.


### Barbell portfolio: 50% in 2yr (D=1.9), 50% in 30yr (D=18). Portfolio D?

- [✓] A: 9.95

- [ ] B: 10.50

- [ ] C: 19.90

- [ ] D: 15.00


**Answer:** A

Portfolio D = 0.5 × 1.9 + 0.5 × 18 = 0.95 + 9 = 9.95


### Private bank client holds $10M bonds, D=7.0. Rates rise 30bp. Expected P&amp;L?

- [ ] A: +$210,000

- [✓] B: -$210,000

- [ ] C: -$70,000

- [ ] D: +$70,000


**Answer:** B

ΔP ≈ -D × Δy × P = -7.0 × 0.003 × $10M = -$210,000


### Modified D = Macaulay D / (1 + YTM/k). k stands for:

- [ ] A: Coupon rate

- [✓] B: Periods per year

- [ ] C: Years to maturity

- [ ] D: Face value


**Answer:** B

k = payment periods per year (2 for semi-annual). Adjusts Macaulay D to periodic yield.


### Duration assumes which yield curve shift?

- [ ] A: Non-parallel

- [✓] B: Parallel

- [ ] C: Curve flattening

- [ ] D: Curve steepening


**Answer:** B

Duration is linear approximation for parallel yield shifts. For non-parallel, key-rate duration needed.


### Bond with high duration benefits most from:

- [ ] A: Rising interest rates

- [✓] B: Falling interest rates

- [ ] C: Rising inflation

- [ ] D: Credit downgrade


**Answer:** B

High duration → greater sensitivity to rate moves. Rates fall → price rises more for high-duration bond.


---

# Module 10: Convexity

Est. study time: 2h

## Learning Objectives
- Explain convexity and why it matters
- Calculate convexity adjustment
- Distinguish positive vs negative convexity
- Compare barbell vs bullet convexity
- Use convexity in portfolio management

---

## Core Content

### What is convexity?

Duration is linear approximation of price-yield curve.

Actual price-yield curve is convex (curved, not straight).

**Convexity** = curvature measure. Improves price change estimate.

Without convexity: `ΔP/P ≈ -D_mod × Δy`

With convexity: `ΔP/P ≈ -D_mod × Δy + 0.5 × Convexity × (Δy)^2`

### Convexity formula

```
Convexity = [Σ t(t+1) × PV(CF_t)] / [P × (1+y)^2]
```

For semi-annual: divide by (1+y/2)^2 instead.

### Convexity benefit

Convexity always positive for straight bonds (no options):

- Rates fall → price rises MORE than duration predicts
- Rates rise → price falls LESS than duration predicts

Investors profit from convexity in volatile markets.

Why is this mechanical? Pull-to-par: as time passes, price-yield relationship becomes less curved (shorter maturity → less convex). This convergence is not driven by rates — pure math of discounting.

### Positive vs negative convexity

| Type | Description | Examples |
|------|-------------|----------|
| **Positive** | Price-yield curve bends upward. Good for holder | Straight bonds, Treasuries |
| **Negative** | Price-yield curve bends downward. Bad for holder | Callable bonds, MBS (prepayment) |

Callable bond: as rates fall, price capped at call price → negative convexity.

MBS: as rates fall, prepayment surges → price appreciation limited → negative convexity.

### Convexity adjustment

```
Price change = -D × Δy + 0.5 × C × (Δy)^2
```

Example: D = 6.0, C = 50, Δy = -1% (rates fall 1%)

Duration only: +6.0%
With convexity: +6.0% + 0.5 × 50 × (0.01)^2 = +6.0% + 0.25% = +6.25%

For Δy = +1% (rates rise):
Duration only: -6.0%
With convexity: -6.0% + 0.25% = -5.75%

Convexity dampens loss in rising rates, boosts gain in falling rates.

### Barbell vs bullet

| Strategy | Composition | Convexity |
|----------|-------------|-----------|
| **Bullet** | Single intermediate maturity | Lower |
| **Barbell** | Short + long maturities | Higher (same duration) |

Barbell has higher convexity than bullet with same duration.

Investor pays for convexity (barbell yields slightly less).

### Why convexity matters

- Large rate moves: duration-only estimate inaccurate
- Volatile markets: convexity adds value (asymmetric price response)
- Portfolio hedging: convexity mismatch creates risk
- Negative convexity: embedded options hurt performance in rally

Question: How large must a rate move be for convexity to matter? Answer: For IG bonds (C=50-100), 100bp move adds ~0.25-0.5% to price estimate. Below 25bp, convexity adjustment <0.03% — negligible. Rule of thumb: convexity matters when |Δy| > 50bp.

---

## Examples

### Example 1: Convexity calculation

Bond price $105, D_mod = 5.0, C = 60. Yield changes from 5% to 4.5% (-50bp).

Duration effect: -5.0 × (-0.005) = +2.50%
Convexity effect: 0.5 × 60 × (0.005)^2 = 0.5 × 60 × 0.000025 = 0.00075 = 0.075%

Total estimate: +2.575%

Actual (exact): likely ~2.58%. Duration alone would say 2.50%.

### Example 2: Negative convexity in MBS

Agency MBS with D = 4.0. Rates fall 1%.

Positive convexity bond (Treasury): price change ≈ +4.0% + convexity boost.

MBS: rates fall → prepayment speeds → average life shortens → duration shortens → price gain capped at ~2.5%.

MBS has negative convexity: duration falls as rates fall, rises as rates rise.

### Example 3: Private bank context

Client holds callable corporate bond. Rates rally (fall 1%).

Duration says +6.0%. But bond is callable → negative convexity → price capped at call price → gains only ~4.5%.

Client disappointed: "My bond didn't rally as much as Treasuries."

Explain: "Bond is callable. Issuer can refinance at lower rate → price appreciation capped. You received higher yield initially but sacrificed upside."

---

## Common Misconception

"Convexity always benefits bondholders." True for straight bonds. But you pay for convexity — barbell yields less than bullet at same duration. Negative convexity (MBS, callables) hurts holders in rallies, benefits them in selloffs.

## Key Takeaways
- Convexity corrects duration's linear approximation
- Positive convexity: gains > losses for same yield move. Good.
- Negative convexity: losses > gains. Bad. (Callable, MBS)
- Barbell > bullet convexity (at same duration)
- Convexity adjustment: +0.5 × C × (Δy)^2
- Negative convexity hurts most in rate rallies

---

## Feynman Explain
Explain convexity to a junior trader: "Why does a bond gain MORE when rates fall than it loses when rates rise?" Use graph of curvy line vs straight line.

*Self-check: Can you explain why MBS has negative convexity and how that affects performance in a rate rally?*

Run: `./scripts/learn.sh explain fixed-income 10-convexity`

---

## Reframe
When is convexity unimportant? (Small rate moves, short maturity bonds, held to maturity.) When is it critical? (Large rate shocks, option-embedded bonds, levered portfolios.) Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 10-convexity`

## Quiz: 10-convexity


### Convexity improves price change estimate by adding:

- [ ] A: A linear term

- [✓] B: A squared term (Δy)^2

- [ ] C: A cubic term

- [ ] D: A constant


**Answer:** B

Convexity adjustment = 0.5 × C × (Δy)^2. Squared term corrects duration's linear approximation.


### For non-callable bond, convexity is:

- [ ] A: Negative

- [ ] B: Zero

- [✓] C: Positive

- [ ] D: Infinite


**Answer:** C

Straight bonds: positive convexity. Price-yield curve curved upward. Convexity benefits holder.


### D = 7.0, C = 40, yield +2%. Duration-only estimate vs with convexity?

- [✓] A: -14.0% vs -13.2%

- [ ] B: -14.0% vs -14.8%

- [ ] C: +14.0% vs +13.2%

- [ ] D: -7.0% vs -6.2%


**Answer:** A

Duration: -7 × 0.02 = -14%. Convexity: 0.5 × 40 × 0.0004 = 0.8%. Total: -13.2%. Convexity reduces loss.


### Which has negative convexity?

- [ ] A: 10yr Treasury

- [ ] B: Zero-coupon bond

- [✓] C: Callable corporate bond

- [ ] D: Municipal GO bond


**Answer:** C

Callable bond: price capped near call price → negative convexity. Rates fall → price appreciation limited.


### Barbell vs bullet (same duration): barbell has:

- [ ] A: Lower convexity

- [✓] B: Higher convexity

- [ ] C: Same convexity

- [ ] D: Negative convexity


**Answer:** B

Barbell (short + long) has higher convexity than bullet (intermediate) at same duration. You pay for convexity via lower yield.


### MBS negative convexity caused by:

- [ ] A: Credit risk

- [✓] B: Prepayment risk (borrowers refinance when rates fall)

- [ ] C: Default risk

- [ ] D: Interest rate risk


**Answer:** B

Rates fall → prepayments rise → principal returned early → duration shortens → price gain limited. Negative convexity.


### Large rate move: convexity effect becomes ___ relative to duration effect.

- [ ] A: Smaller

- [✓] B: Larger

- [ ] C: Negligible

- [ ] D: Zero


**Answer:** B

Convexity term uses (Δy)^2. Large Δy → squared term grows faster. More important for big moves.


### D = 5.0, C = 30, yield -1.5%. Estimate price change with convexity?

- [ ] A: +7.50%

- [✓] B: +7.84%

- [ ] C: +6.75%

- [ ] D: +8.25%


**Answer:** B

Duration: -5 × (-0.015) = +7.5%. Convexity: 0.5 × 30 × 0.000225 = 0.34%. Total: +7.84%


### Private bank client: 'My callable bond fund underperformed the Treasury index in a rate rally.' Likely cause?

- [ ] A: Credit downgrade

- [✓] B: Negative convexity from callable bonds limits upside

- [ ] C: Fund fees increased

- [ ] D: Maturity too short


**Answer:** B

Callable bonds: negative convexity. Rates fall → price capped at call price → gains less than non-callable bonds.


### When is convexity least important for price estimation?

- [ ] A: 200bp rate move

- [✓] B: 10bp rate move

- [ ] C: Bond with 20yr maturity

- [ ] D: Bond with embedded options


**Answer:** B

Small rate moves (10bp): duration approximation accurate enough. Convexity matters for large moves (&gt;50-100bp).


---

# Module 11: Credit Analysis

Est. study time: 2.5h

## Learning Objectives
- Analyze financial ratios for credit assessment
- Identify credit events and triggers
- Evaluate downgrade risk and fallen angels
- Understand recovery analysis
- Apply framework across IG and HY

---

## Core Content

### Credit analysis framework

**Four Cs of Credit:**
1. **Capacity**: ability to repay (cash flow)
2. **Collateral**: assets securing debt
3. **Covenants**: legal protections
4. **Character**: management quality, track record

### Key financial ratios

| Ratio | Formula | Investment grade | High yield |
|-------|---------|------------------|------------|
| **Debt/EBITDA** | Total debt / EBITDA | < 2.5x | 3-6x |
| **EBITDA/Interest** | EBITDA / interest expense | > 8x | 2-4x |
| **FFO/Debt** | Funds from ops / debt | > 30% | 10-20% |
| **FCF/Debt** | Free cash flow / debt | > 10% | 0-5% |

### Cash flow analysis

Three sources:
- **Operating CF**: core business cash generation (most important)
- **Investing CF**: capex, acquisitions (drain)
- **Financing CF**: debt issuance, equity, dividends

Credit analyst focuses on: EBITDA, FFO, FCF, capex, dividends.

### Credit events

| Event | Description | Impact |
|-------|-------------|--------|
| **Missed payment** | Coupon/principal not paid on time | Default if not cured |
| **Cross-default** | Default on one bond triggers default on all | Broad acceleration |
| **Covenant breach** | Violation of negative/affirmative covenant | Potential default |
| **Bankruptcy filing** | Chapter 11 (reorg) or Chapter 7 (liquidation) | Bondholder recovery process |
| **Distressed exchange** | Bond swap at terms worse than original | Technical default |

Question: Cross-default sounds harsh — does it apply automatically? Answer: Usually requires acceleration vote by bondholders. Not automatic. Gives creditors negotiating leverage.

### Downgrade risk

Rating migration matrix: probability of moving from one rating to another.

| From / To | AAA | AA | A | BBB | BB | B | Default |
|-----------|-----|----|---|-----|----|---|---------|
| **BBB** | 0% | 1% | 8% | 85% | 4% | 1% | 1% |
| **BB** | 0% | 0% | 1% | 10% | 78% | 8% | 3% |

**Fallen angel**: downgraded from IG to HY. Causes forced selling by IG mandates.

**Rising star**: upgraded from HY to IG. Price rally as new buyers enter.

### Sector analysis

Different industries have different credit metrics:

| Sector | EBITDA/Interest typical | Key risk |
|--------|------------------------|----------|
| Utilities | 3-5x | Regulation, capex |
| Technology | 10-30x | Disruption |
| Energy | 4-8x | Commodity price |
| Healthcare | 4-6x | Patent cliff, regulation |
| Retail | 3-5x | Competition, margins |
| Financials | N/A (different metrics) | Capital, NPLs |

Default rate varies by sector: utilities ~0.2%/yr, technology ~0.5%/yr, energy ~2-8%/yr (commodity cycle dependent), retail ~3-6%/yr (structural decline). Sector matters as much as rating.

### Recovery analysis

Value of collateral + cash flows in default.

Secured vs unsecured recovery waterfall.

Liquidation analysis vs going-concern valuation.

Recovery ratings: LGD (Loss Given Default) assessment.

---

## Examples

### Example 1: Credit ratio calculation

Company: Debt = $5B, EBITDA = $1.8B, Interest = $250M

Debt/EBITDA = $5B / $1.8B = 2.78x (OK for IG)
EBITDA/Interest = $1.8B / $250M = 7.2x (weak for IG, borderline)

Assessment: weak coverage. If EBITDA falls → coverage deteriorates → downgrade risk.

### Example 2: Fallen angel scenario

BBB-rated retailer. Earnings decline → Debt/EBITDA rises to 4.5x → S&P downgrades to BB+.

Price impact: bonds drop 5-15% as IG forced sellers exit.
Opportunity for HY funds to buy at discount.

### Example 3: Private bank context

Client holds $3M of BBB telecom bonds. Analyst reports showing leverage increasing due to spectrum auction spending.

Action: monitor covenant headroom. Consider hedging with CDS or reducing position before potential downgrade.

---

## Common Misconception

"Strong ratios = safe bond." Enron had healthy ratios pre-collapse. Ratios measure capacity, not character or accounting quality. Qualitative factors (management, competitive moat, accounting policies) matter as much.

## Key Takeaways
- Four Cs: Capacity, Collateral, Covenants, Character
- Key ratios: Debt/EBITDA, EBITDA/Interest, FFO/Debt
- Credit events: missed payment, cross-default, covenant breach
- Fallen angel: IG to HY → forced selling pressure
- Different sectors have different leverage norms
- Recovery analysis determines expected loss given default

---

## Feynman Explain
Explain credit analysis to a client: "How do you decide if a company can pay back its debt?" Use personal finance analogy (mortgage approval — income, existing debt, savings).

*Self-check: Can you explain why a fallen angel bond might be a good buying opportunity for HY investors?*

Run: `./scripts/learn.sh explain fixed-income 11-credit-analysis`

---

## Reframe
Critique reliance on credit ratios: "Do financial ratios predict default?" Consider: Enron had healthy ratios pre-collapse, accounting manipulation, and the role of qualitative factors. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 11-credit-analysis`

## Quiz: 11-credit-analysis


### Debt/EBITDA of 5.5x is typical for which credit category?

- [ ] A: AAA

- [ ] B: A

- [✓] C: High yield

- [ ] D: Treasury


**Answer:** C

IG: Debt/EBITDA &lt; 2.5-3x. HY: 3-6x. 5.5x falls in HY range.


### EBITDA/Interest = interest coverage ratio. IG typically above:

- [ ] A: 3x

- [✓] B: 8x

- [ ] C: 2x

- [ ] D: 15x


**Answer:** B

IG interest coverage &gt; 8x typically. Below 3x is distressed.


### Fallen angel is a bond:

- [ ] A: Upgraded from HY to IG

- [✓] B: Downgraded from IG to HY

- [ ] C: Called by issuer

- [ ] D: Matured


**Answer:** B

Fallen angel: IG to HY downgrade. Triggers forced selling by IG-only mandates.


### Cross-default provision means:

- [✓] A: Default on one obligation is default on all

- [ ] B: Bonds are cross-collateralized

- [ ] C: Two different currencies

- [ ] D: Swap counterparty defaults


**Answer:** A

Cross-default: default on any debt instrument triggers default on all under same indenture.


### Company: Debt $8B, EBITDA $1.6B, Interest $400M. Debt/EBITDA?

- [ ] A: 2.0x

- [ ] B: 4.0x

- [✓] C: 5.0x

- [ ] D: 8.0x


**Answer:** C

$8B / $1.6B = 5.0x. High leverage — likely HY.


### Company: Debt $4B, EBITDA $1.2B, Interest $150M. EBITDA/Interest?

- [ ] A: 6x

- [✓] B: 8x

- [ ] C: 10x

- [ ] D: 12x


**Answer:** B

$1.2B / $150M = 8.0x. Borderline IG coverage.


### Rising star is:

- [ ] A: A tech company IPO

- [✓] B: HY to IG upgrade

- [ ] C: Bond with above-market coupon

- [ ] D: TIPS with inflation adjustment


**Answer:** B

Rising star: upgraded from HY to IG. New buyer base enters → price rally.


### Private bank client wants highest recovery in default. Recommend:

- [ ] A: Subordinated unsecured bond

- [✓] B: Senior secured bond

- [ ] C: Preferred stock

- [ ] D: Convertible bond


**Answer:** B

Senior secured: highest priority. Collateral-backed. Recovery 50-80%. Subordinated: 10-30%.


### A distressed exchange is considered:

- [ ] A: Normal refinancing

- [✓] B: Technical default (bondholders accept worse terms)

- [ ] C: Rating upgrade event

- [ ] D: Merger arbitrage


**Answer:** B

Distressed exchange: bondholders swap bonds at less-favorable terms. Credit event — often treated as default.


### Which industry typically has highest leverage tolerance?

- [ ] A: Technology

- [✓] B: Utilities

- [ ] C: Energy

- [ ] D: Pharmaceuticals


**Answer:** B

Utilities: stable cash flows, regulated returns → can support higher leverage (3-5x). Tech: low debt typically.


---

# Module 12: Credit Derivatives (CDS)

Est. study time: 2h

## Learning Objectives
- Explain CDS mechanics and terminology
- Understand CDS pricing and spread interpretation
- Describe CDS basis trade
- Understand CDS indices and standardized contracts

---

## Core Content

### What is CDS?

Credit Default Swap = insurance against default.

- **Protection buyer**: pays periodic premium (spread)
- **Protection seller**: makes payment if credit event occurs

Key difference from insurance: CDS can be bought without owning underlying bond ("naked CDS"). Insurance requires insurable interest.

Contract terms:
- **Reference entity**: company or sovereign
- **Notional**: amount protected
- **Maturity**: 1yr, 3yr, 5yr, 7yr, 10yr (5yr most liquid)
- **Coupon**: standard 100bp or 500bp
- **Upfront payment**: difference between standard coupon and market spread

### Credit events

ISDA (International Swaps and Derivatives Association) defines:

1. **Bankruptcy** (corporate)
2. **Failure to pay** (corporate + sovereign)
3. **Restructuring** (corporate)
4. **Obligation acceleration** (rare)
5. **Repudiation/Moratorium** (sovereign)

2009 "Big Bang" protocol: standardized auctions for settlement.

### CDS pricing

```
CDS spread ≈ (1 - Recovery) × Probability of default
```

Example: Recovery = 40%, PD = 2% annually
CDS spread ≈ (1 - 0.40) × 2% = 1.2% = 120bp

Market CDS spread reflects market's view of credit risk.

Why standard coupons 100bp and 500bp? Standardization makes CDS tradeable like bonds. Instead of negotiating spread per trade, market quotes upfront payment to adjust — same efficiency as bond price vs coupon.

### Upfront payment

Standard coupons: 100bp (IG) or 500bp (HY).

If market spread > standard coupon → protection seller pays upfront (buyer pays less premium).

If market spread < standard coupon → protection buyer pays upfront.

Example: 5yr CDS at 180bp. Standard coupon = 100bp.
Buyer pays ≈ 80bp × duration as upfront.

### CDS indices

| Index | Region | Entities | Type |
|-------|--------|----------|------|
| **CDX.NA.IG** | North America | 125 | IG |
| **CDX.NA.HY** | North America | 100 | HY |
| **iTraxx Europe** | Europe | 125 | IG |
| **iTraxx Crossover** | Europe | 75 | HY |

Traded as single contract. Each series has fixed membership, rolls every 6 months.

### CDS basis

```
Basis = CDS spread - Bond spread (over same reference rate)
```

| Basis | Meaning | Trade |
|-------|---------|-------|
| **Positive** | CDS > bond spread | Sell CDS, buy bond (cheap funding) |
| **Negative** | CDS < bond spread | Buy CDS, short bond |
| **Zero** | Fair value | No arb |

Negative basis common in stressed markets (CDS cheap vs cash).

### Uses of CDS

1. **Hedging credit exposure** without selling bond
2. **Short credit** (buy protection) when bond hard to borrow
3. **Synthetic long credit** (sell protection) for yield
4. **Basis trading** (cash vs synthetic arb)
5. **Portfolio management** (adjust credit exposure efficiently)

### Sovereign CDS

Same mechanics but credit events include:
- Failure to pay
- Moratorium/Repudiation
- Restructuring

Sovereign CDS spreads: Greece >1000bp (2012), Germany ~10bp.

---

## Examples

### Example 1: CDS hedge

Bank holds $10M of BBB corporate bonds. Wants to hedge credit risk.

Buys $10M CDS protection at 150bp.

Annual cost = $10M × 1.5% = $150,000

If bond defaults: bank loses on bond, but CDS pays out (par - recovery).

Net position: hedged.

### Example 2: Negative basis trade

Bond yields 200bp over LIBOR. CDS = 150bp.

Basis = -50bp.

Buy bond (earn 200bp), buy CDS (pay 150bp). Net = 50bp risk-free + carry.

Trade works if basis converges to zero.

### Example 3: Private bank context

Client's portfolio concentrated in banking sector. Comfort with bank credit but wants to dial down sector weight temporarily.

Instead of selling bonds (tax, transaction cost): buy CDS protection on bank index for 6 months.

Synthetic hedge. Remove when comfortable.

---

## Common Misconception

"CDS = insurance, always pays out." Protection seller can fail (AIG 2008). Auction determines recovery — may be less than expected. Legal disputes over credit events common. Counterparty risk matters.

## Key Takeaways
- CDS = credit insurance. Protection buyer pays spread
- Standard coupons: 100bp (IG), 500bp (HY). Upfront payment for difference
- Credit events: bankruptcy, failure to pay, restructuring
- CDS spread ≈ (1-Recovery) × PD
- Indices: CDX (US), iTraxx (Europe)
- Basis = CDS spread - bond spread. Negative basis = cash cheap vs CDS
- CDS enables synthetic long/short credit exposure

---

## Feynman Explain
Explain CDS to a colleague: "How can you insure a bond against default?" Use car insurance analogy. Who pays premium, who receives payout.

*Self-check: Can you explain why CDS spread can differ from bond spread (basis) and what a negative basis means?*

Run: `./scripts/learn.sh explain fixed-income 12-credit-derivatives-cds`

---

## Reframe
Critique CDS market: "Are CDS speculators destabilizing?" Consider: AIG 2008, naked CDS (buying protection without owning bond), transparency reforms. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 12-credit-derivatives-cds`

## Quiz: 12-credit-derivatives-cds


### In CDS, protection buyer:

- [ ] A: Receives premium

- [✓] B: Makes periodic payments to seller

- [ ] C: Has no counterparty risk

- [ ] D: Must own the underlying bond


**Answer:** B

Protection buyer pays periodic premium (CDS spread) to seller. In return, seller compensates if credit event occurs.


### Standard running coupon for IG CDS is:

- [ ] A: 50bp

- [✓] B: 100bp

- [ ] C: 500bp

- [ ] D: 1000bp


**Answer:** B

IG standard coupon = 100bp. HY = 500bp. Upfront payment adjusts for difference vs market spread.


### Which ISDA credit event applies only to corporates?

- [ ] A: Failure to pay

- [ ] B: Restructuring

- [✓] C: Bankruptcy

- [ ] D: Repudiation


**Answer:** C

Bankruptcy is corporate-specific. Repudiation/moratorium is sovereign-specific. Failure to pay and restructuring apply to both.


### Recovery = 30%, PD = 3%. Fair CDS spread estimate?

- [ ] A: 90bp

- [ ] B: 180bp

- [✓] C: 210bp

- [ ] D: 300bp


**Answer:** C

Spread ≈ (1-0.30) × 3% = 0.70 × 3% = 2.1% = 210bp


### CDS basis = -40bp means:

- [ ] A: CDS spread &gt; bond spread by 40bp

- [✓] B: CDS spread &lt; bond spread by 40bp

- [ ] C: Bond is trading at discount

- [ ] D: CDS has no value


**Answer:** B

Basis = CDS - bond spread. Negative: CDS cheaper than cash bond. Buy bond, buy CDS → arb profit.


### CDX.NA.IG contains how many North American IG entities?

- [ ] A: 50

- [ ] B: 100

- [✓] C: 125

- [ ] D: 250


**Answer:** C

CDX.NA.IG = 125 IG names. CDX.NA.HY = 100 HY names. iTraxx Europe = 125 names.


### What happens to CDS if reference entity defaults?

- [ ] A: CDS expires worthless

- [✓] B: Protection seller pays protection buyer (par - recovery)

- [ ] C: Both parties terminate

- [ ] D: CDS continues with different entity


**Answer:** B

Credit event → auction determines recovery price. Seller pays buyer (par - recovery) × notional.


### Negative basis trade:

- [ ] A: Short bond, sell CDS

- [✓] B: Buy bond, buy CDS

- [ ] C: Buy bond, sell CDS

- [ ] D: Short bond, buy CDS


**Answer:** B

Negative basis = CDS cheap vs cash. Buy bond (earn spread), buy CDS (pay cheap premium). Net positive carry + hedged.


### Private bank client wants to hedge credit risk without selling bonds. Best tool?

- [ ] A: Treasury future

- [✓] B: CDS

- [ ] C: Interest rate swap

- [ ] D: Equity put


**Answer:** B




### CDS indices roll every:

- [ ] A: Monthly

- [ ] B: Quarterly

- [✓] C: Every 6 months

- [ ] D: Annually


**Answer:** C

CDX and iTraxx roll every 6 months (March/September). New series issued with updated constituent list.


---

# Module 13: Bond Trading & OTC Markets

Est. study time: 2h

## Learning Objectives
- Explain OTC bond market structure
- Understand bid-ask spread and liquidity
- Interpret TRACE data
- Describe electronic trading evolution
- Analyze factors affecting liquidity

---

## Core Content

### OTC market structure

Bonds trade over-the-counter (OTC), not on exchanges.

Why OTC, not exchange? Bonds are heterogeneous — thousands of unique issues per issuer (different coupons, maturities, seniority, covenants). Exchange needs standardized product. Stocks: one ticker per company. Bonds: dozens per company.

Dealer vs customer trades. No centralized order book.

Market participants:
- **Primary dealers**: trade directly with Fed, make markets in Treasuries
- **Regional dealers**: focus on specific sectors
- **Institutional investors**: asset managers, insurance, pension funds
- **Hedge funds**: active traders, relative value
- **Retail**: through brokers, limited access

### Bid-ask spread

| Bond type | Typical bid-ask |
|-----------|-----------------|
| On-the-run Treasury | 0.5-1bp |
| Off-the-run Treasury | 1-5bp |
| Agency MBS | 2-5bp |
| IG corporate | 5-25bp |
| HY corporate | 25-100bp |
| Municipal | 10-100bp |

Determinants of spread:
- Liquidity (most important)
- Trade size
- Market conditions
- Time of day
- Dealer inventory

### TRACE reporting

Trade Reporting and Compliance Engine (FINRA).

Since 2002: corporate bond trades reported publicly.

Increased transparency significantly. Tightened spreads post-TRACE.

Data: price, volume, yield, trade date/time.

### Electronic trading evolution

| Era | Platform type | Examples |
|-----|--------------|----------|
| Pre-2000 | Phone/voice | Dealer calls |
| 2000-2010 | Dealer-to-client | MarketAxess, TradeWeb |
| 2010-2020 | All-to-all | Direct exchange protocols |
| 2020+ | Electronification + automation | Algos, portfolio trading |

Electronic share of IG corporate trading: ~40% (growing).

### Liquidity

Bond market liquidity: episodic, not constant.

**Good times**: tight spreads, easy execution.
**Stress times**: spreads blow out, dealers step back.

How likely are liquidity crises? Major episodes: 2008 (MBS/corporate freeze), 2020 (COVID dash-for-cash). Minor events every 2-3 years. IG corporate spreads widened ~200bp in 3 weeks during March 2020, then recovered after Fed intervention.

Liquidity providers: dealers (risk capital), electronic platforms (limit orders).

Liquidity measurement:
- **Bid-ask spread**: narrow = liquid
- **Trade volume**: high = liquid
- **Price impact**: small = liquid
- **Dealer quote depth**: deep = liquid

### Portfolio trading

Increasing trend: trade entire portfolio of bonds in single block.

Advantage: execution speed, lower overall cost.

Disadvantage: dealer charges premium for risk.

### Trading strategies

| Strategy | Description |
|----------|-------------|
| **Outright** | Buy or sell single bond |
| **Switch** | Sell one bond, buy another |
| **Butterfly** | Long one maturity, short two others |
| **Curve trade** | Position for steepening/flattening |
| **RV trade** | Relative value between similar bonds |

---

## Examples

### Example 1: Bid-ask cost

Client wants to buy $5M of a BBB-rated corporate bond.

Bid = 99.75, Ask = 100.25. Spread = 50bp.

Cost to buy then immediately sell: 50bp × $5M = $25,000.

Important consideration for private bank: hold period needed to overcome transaction cost.

### Example 2: TRACE check

Client sees bond priced at 98.50. Check TRACE for recent trades.

Last 10 trades: 98.25-98.75 range. Volume $1M-$5M.

Confirms 98.50 is fair price. Dealer not overcharging.

### Example 3: Liquidity in stress

March 2020: IG corporate bonds. Bid-ask spreads went from 10bp to 100bp+.

Dealers withdrew. Fed intervened (SMCCF) to restore liquidity.

Client trying to sell: could not get price without large concession.

---

## Common Misconception

"Bonds trade like stocks — visible price, easy execution." No. OTC market means negotiated prices, wide spreads for small issues, and liquidity that disappears in stress. TRACE helps but covers only executed trades, not quotes.

## Key Takeaways
- Bonds trade OTC. Dealer-intermediated.
- Bid-ask varies by bond type and market conditions
- TRACE increased transparency significantly
- Electronic trading growing (especially IG)
- Liquidity is episodic — fine in normal times, scarce in stress
- Portfolio trading gaining share
- Transaction costs matter for total return

---

## Feynman Explain
Explain OTC bond trading to a client: "Why can't I see the bond price on a screen like I can with stocks?" Compare to real estate market (dealer-to-dealer, phone-based, negotiated prices).

*Self-check: Can you explain why TRACE reporting improved market quality?*

Run: `./scripts/learn.sh explain fixed-income 13-bond-trading-and-otc-markets`

---

## Reframe
Critique bond market structure: "Is OTC market structure better than exchange trading?" Consider: liquidity during stress, dealer balance sheet capacity, transparency, and client protection. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 13-bond-trading-and-otc-markets`

## Quiz: 13-bond-trading-and-otc-markets


### Bonds primarily trade on:

- [ ] A: Centralized stock exchanges

- [✓] B: Over-the-counter (dealer network)

- [ ] C: Futures exchanges

- [ ] D: Electronic auction every hour


**Answer:** B

Bonds trade OTC. Dealers quote prices to customers. No centralized exchange like equities.


### On-the-run 10yr Treasury typical bid-ask spread:

- [✓] A: 0.5-1bp

- [ ] B: 10-20bp

- [ ] C: 25-50bp

- [ ] D: 100bp


**Answer:** A

On-the-run Treasuries: most liquid instrument globally. 0.5-1bp typical.


### TRACE provides:

- [ ] A: Real-time equity prices

- [✓] B: Post-trade transparency for corporate bonds

- [ ] C: Credit ratings

- [ ] D: Currency exchange rates


**Answer:** B

TRACE (FINRA): all corporate bond trades reported publicly. Price, volume, yield.


### HY corporate bond typical bid-ask spread:

- [ ] A: 1-5bp

- [ ] B: 5-10bp

- [✓] C: 25-100bp

- [ ] D: 200-500bp


**Answer:** C

HY bonds: less liquid, higher credit risk → wider spreads. Typically 25-100bp depending on rating and size.


### Bond market liquidity in March 2020:

- [ ] A: Improved significantly

- [✓] B: Deteriorated sharply (spreads blew out)

- [ ] C: Remained unchanged

- [ ] D: Moved to exchange trading


**Answer:** B

COVID stress: liquidity evaporated. IG spreads jumped from 10bp to 100bp+. Fed intervention restored function.


### Portfolio trading allows:

- [ ] A: Trading only one bond at a time

- [✓] B: Trading entire bond portfolio in single block

- [ ] C: Buying bond ETFs only

- [ ] D: Trading on margin


**Answer:** B

Portfolio trading: list of bonds traded as single risk transfer. Growing trend, especially for IG.


### Private bank client wants to buy $10M of a small muni issue. Expected liquidity?

- [ ] A: Very liquid — tight spreads

- [✓] B: Illiquid — wide spreads, hard to find natural seller

- [ ] C: Same as on-the-run Treasury

- [ ] D: Guaranteed execution at mid-price


**Answer:** B

Small muni issues: infrequent trading, limited dealer inventory → wide spreads, difficult execution for size.


### All-to-all trading means:

- [ ] A: Dealers only trade with each other

- [✓] B: Any market participant can trade with any other

- [ ] C: Only central bank trades

- [ ] D: Retail only


**Answer:** B

All-to-all: platforms allow investors to trade directly with each other, not just through dealers.


### Which factor MOST affects corporate bond bid-ask spread?

- [ ] A: Coupon rate

- [✓] B: Liquidity (trade frequency, issue size)

- [ ] C: Accrued interest

- [ ] D: Day of week


**Answer:** B

Liquidity dominates: frequent trading + large issue size → tight spreads. Illiquid bonds have wide spreads.


### Dealers widen spreads during stress because:

- [ ] A: They want higher profits

- [✓] B: Inventory risk increases — harder to hedge, capital constrained

- [ ] C: Regulations require it

- [ ] D: Clients prefer wider spreads


**Answer:** B

Stress: dealer inventory risk rises, bid-ask hedging cost increases, balance sheet constraints bind. Wider spreads compensate.


---

# Module 14: Bond Settlement & Custody

Est. study time: 2h

## Learning Objectives
- Explain DVP settlement model
- Understand settlement fails and penalties
- Describe clearing house role (FICC, NSCC, Euroclear)
- Contrast physical vs book-entry custody
- Understand tri-party repo custody

---

## Core Content

### Trade lifecycle

```
Trade date (T) → Settlement date (T+1, T+2, T+3)
```

| Asset | Settlement | Standard |
|-------|-----------|----------|
| Treasuries | T+1 | Since 2017 (was T+2) |
| Corporate bonds | T+1 | Since 2024 (was T+2) |
| Muni bonds | T+1 | Since 2024 |
| MBS | T+1 (specified pool) | |
| Repo | Same day (T+0) | |

### DVP (Delivery vs Payment)

Simultaneous exchange: bonds delivered ↔ cash paid.

Eliminates principal risk (one party delivers, other doesn't pay).

Why DVP instead of trust? Before DVP, settlement required trust or letters of credit. DVP makes settlement atomic — like an escrow. Fedwire Securities Service moves bonds and cash simultaneously.

DVP Model 1: gross settlement, trade-by-trade.
DVP Model 2: net cash, gross securities.
DVP Model 3: net securities, net cash.

### Settlement fails

Fail = seller fails to deliver bonds on settlement date.

Causes:
- Operational error (trade not matched)
- Short position (bond not located)
- Market disruption

Penalties:
- Treasury fails: charged at spread below Fed funds (since 2009)
- Corporate bonds: contractual, varies
- Fails in high-demand securities: special repo rates

Question: What happens if both sides fail simultaneously? Answer: "Link" or "daisy chain" fails cascade — one fail causes another. FICC netting reduces this. In 2020, Treasury fails briefly spiked to ~$1T before penalty regime kicked in.

### Clearing houses

| Entity | Role |
|--------|------|
| **FICC** (Fixed Income Clearing Corp) | Treasury, agency MBS clearing |
| **DTCC** | Corporate bond settlement |
| **Euroclear / Clearstream** | International bonds (Eurobonds) |
| **LCH** | Repo clearing, CDS clearing |

Clearing house becomes central counterparty (CCP) — guarantees trade completion.

### Book-entry vs physical

| Type | Description | Current status |
|------|-------------|----------------|
| **Physical certificate** | Paper bond | Obsolete (except some munis) |
| **Book-entry** | Electronic record at depository | Standard (Fedwire, DTC) |

Treasuries: book-entry at Fedwire Securities Service.
Corporate bonds: book-entry at DTC (Depository Trust Company).

### Custody

Custodian holds securities on behalf of client.

| Type | Examples | Services |
|------|----------|----------|
| **Global custodian** | BNY, State Street, JPMorgan | Settlement, safekeeping, FX, reporting |
| **Prime broker** | For hedge funds | Financing, leverage, securities lending |
| **Sub-custodian** | Local market agents | Access to foreign markets |

### Margin and collateral management

Variation margin: daily mark-to-market for derivatives.
Initial margin: upfront collateral for non-cleared derivatives.

Collateral transformation: convert available assets into required collateral type.

### Asset servicing

- Coupon collection
- Maturity redemption
- Corporate actions (tender, exchange, consent solicitation)
- Withholding tax processing

---

## Examples

### Example 1: Settlement timeline

Client buys $5M corporate bond on Monday.

Trade date: Monday
Settlement: Wednesday (T+2 → now T+1)

Client must have $5M + accrued in account by settlement.
If not: failed trade, penalties.

### Example 2: Fail penalty

Client sells $10M Treasury. Fails to deliver because bond on loan.

Penalty: shortfall × (fail rate) × days.

Fail rate = Fed funds - 3% (if Fed funds = 5.33%, fail rate = 2.33%).

$10M × 2.33% × 1/360 = $647 per day.

### Example 3: Private bank context

Client holds international bond portfolio across US, EU, Asia.

Custodian BNY handles:
- US bonds at DTC
- EU bonds at Euroclear
- Asian bonds via sub-custodian network

Client sees single aggregated statement. Underlying settlement happens in each market.

---

## Key Takeaways
- DVP: simultaneous delivery vs payment. Eliminates principal risk
- T+1 settlement new standard for most bonds
- Fails: penalty costs for late delivery
- FICC clears Treasuries, agency MBS. DTC for corporate bonds
- Book-entry electronic — physical certificates obsolete
- Custodians provide safekeeping, settlement, income collection
- Collateral management essential for derivatives

---

## Feynman Explain
Explain settlement to a client: "You bought a bond today. When do you need to pay?" Use Amazon delivery analogy (order today, receive tomorrow + pay on delivery).

*Self-check: Can you explain why DVP eliminates principal risk but not operational risk?*

Run: `./scripts/learn.sh explain fixed-income 14-bond-settlement-and-custody`

---

## Reframe
Critique T+1 settlement: "Is faster settlement always better?" Consider: operational burden, cross-border complexity, error reconciliation time, Asian market timing. Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 14-bond-settlement-and-custody`

## Quiz: 14-bond-settlement-and-custody


### Treasury settlement standard since 2017:

- [ ] A: T+0

- [✓] B: T+1

- [ ] C: T+2

- [ ] D: T+3


**Answer:** B

Treasuries moved to T+1 in 2017. Corporates and munis followed to T+1 in 2024.


### DVP ensures:

- [ ] A: Payment before delivery

- [✓] B: Simultaneous exchange of securities and cash

- [ ] C: Delivery before payment

- [ ] D: Net settlement at month end


**Answer:** B

DVP: both legs settle simultaneously. No principal risk.


### A settlement fail is:

- [ ] A: Trade rejected by exchange

- [✓] B: Failure to deliver securities or cash on settlement date

- [ ] C: Bond default

- [ ] D: Custodian bankruptcy


**Answer:** B

Fail: seller doesn't deliver or buyer doesn't pay on settlement date. Incurs penalty.


### Which entity clears US Treasury and agency MBS trades?

- [ ] A: Euroclear

- [✓] B: FICC

- [ ] C: LCH

- [ ] D: CME


**Answer:** B

FICC (Fixed Income Clearing Corp) — subsidiary of DTCC. Clears Treasuries and agency MBS.


### US corporate bonds are held in book-entry form at:

- [ ] A: Fedwire

- [✓] B: DTC

- [ ] C: Euroclear

- [ ] D: Federal Reserve


**Answer:** B

DTC (Depository Trust Company) holds corporate, muni, and agency bonds in book-entry form.


### Global custodian BNY Mellon's role includes:

- [ ] A: Setting interest rates

- [✓] B: Settlement, safekeeping, income collection, FX

- [ ] C: Underwriting new bonds

- [ ] D: Credit rating


**Answer:** B

Custodians: settlement, safekeeping, coupon collection, corporate actions, FX, reporting.


### Private bank client fails to deliver $20M Treasuries for 3 days. Fail penalty rate = 2%. Approximate penalty?

- [✓] A: $3,333

- [ ] B: $10,000

- [ ] C: $400,000

- [ ] D: $20,000


**Answer:** A

Penalty = $20M × 2% × 3/360 = $20M × 0.000167 = $3,333


### Principal risk in settlement is the risk that:

- [ ] A: Bond price changes before settlement

- [✓] B: One party delivers but counterparty does not

- [ ] C: Custodian goes bankrupt

- [ ] D: Interest rates rise


**Answer:** B

Principal risk: one leg settles, other doesn't. DVP eliminates this by making exchange simultaneous.


### Collateral transformation means:

- [ ] A: Selling collateral at a loss

- [✓] B: Converting available assets into acceptable collateral type via swap/repo

- [ ] C: Writing off bad collateral

- [ ] D: Increasing haircut


**Answer:** B

Collateral transformation: convert sub-eligible assets into required form (e.g., corporate bonds → Treasuries via repo).


### Physical bond certificates are now:

- [ ] A: Standard for all bonds

- [✓] B: Rare — mostly book-entry electronic

- [ ] C: Required for Treasuries

- [ ] D: Used for repo


**Answer:** B

Book-entry electronic is standard. Physical certificates still exist for some munis but increasingly rare.


---

# Module 15: Brokerage Operations for Fixed Income

Est. study time: 2.5h

## Learning Objectives
- Describe trade life cycle end-to-end
- Understand prime brokerage services
- Explain margin requirements for bonds
- Analyze trade reporting obligations
- Understand operational risk in FI trading

---

## Core Content

### Trade life cycle

**Front office** → **Middle office** → **Back office**

| Phase | Description | Owner |
|-------|-------------|-------|
| **Trade execution** | Dealer quotes, client agrees | Trader / Sales |
| **Trade capture** | Enter trade into system | Trader |
| **Confirmation** | Match trade details with counterparty | Middle office |
| **Affirmation** | Both parties confirm terms | Middle office |
| **Settlement** | Exchange securities for cash | Back office |
| **Clearing** | CCP guarantees | Clearing house |

Question: Why separate confirmation and affirmation? They sound similar. Answer: Confirmation = match trade details (price, quantity, counterparty). Affirmation = both sides explicitly agree matched details correct. Two-step catch errors before settlement.

### Prime brokerage

Services for hedge funds and professional clients:

| Service | Description |
|---------|-------------|
| **Execution** | Access to dealer network |
| **Financing** | Borrow cash (repo) to lever positions |
| **Securities lending** | Borrow bonds for short selling |
| **Custody** | Hold assets, settle trades |
| **Margin** | Finance with leverage |
| **Reporting** | P&L, risk, position reports |
| **Capital introduction** | Connect with investors |

### Margin requirements

**Regulation T (Reg T)**: 50% initial margin for equities.

**Bonds**: lower margin (less volatile). Typically 2-10% for Treasuries, 10-30% for corporates.

**Portfolio margin**: risk-based margin using SPAN-like methodology.

Margin call calculation:
```
Margin call = [Required margin % × Position value] - Existing equity
```

### Trade confirmation

**Voice trades** → confirmed electronically (Bloomberg, MarkitWire).

**Affirmation platforms**: DTCC CTM (Central Trade Manager), Bloomberg.

**SSI (Standard Settlement Instructions)**: pre-agreed settlement details per counterparty.

### Reporting obligations

| Regulation | Requirement |
|------------|-------------|
| **TRACE** | Corporate bond trade reporting (within 15 min) |
| **MSRB** | Muni bond trade reporting |
| **EMIR** (EU) | OTC derivative reporting |
| **Dodd-Frank** | Swap reporting to SDR |
| **MiFID II** | Transaction reporting, best execution |

### Operational risk

| Risk type | Example |
|-----------|---------|
| **Trade error** | Wrong bond, wrong quantity, wrong price |
| **Settlement fail** | Failed to deliver/receive |
| **Confirmation mismatch** | Disagreed trade details |
| **Fraud** | Unauthorized trading, false reporting |
| **Systems failure** | Trading platform outage |

Operational risk controls: dual authorization, reconciliation, STP (straight-through processing).

### Leverage and margin in practice

Hedge fund $100M equity, buys $500M bonds.

Leverage = $500M / $100M = 5x.

If bond price falls 3%:
- Loss = $15M (15% of equity)
- Equity drops to $85M
- Leverage rises to $485M / $85M = 5.7x
- Margin call: post more equity or reduce position

### Settlement Instruction management

Standing Settlement Instructions (SSI) stored for each counterparty.

Changes confirmed via SWIFT or secure messaging.

SSI fraud: criminals change settlement instructions → payment sent to wrong account.

---

## Examples

### Example 1: Trade life cycle walk-through

Monday 10am: PM buys $10M of 5yr Treasury at yield 4.05%.
- Front office: trade executed via MarketAxess
- Middle office: trade matched on FICC
- Back office: settlement Tuesday (T+1) via Fedwire

### Example 2: Margin call scenario

Client buys $20M HY bonds on margin. 20% maintenance margin.

Equity required = $20M × 20% = $4M.

Client posts $5M equity. Leverage = 4x.

Bonds fall 5% → position = $19M. Equity falls to $5M - $1M = $4M.

Margin ratio = $4M / $19M = 21% (above 20%, OK but close).

Further 2% drop → position = $18.62M. Equity = $4M - $0.38M = $3.62M. Margin = 19.4%. Margin call.

### Example 3: Private bank reporting

Client receives monthly statement:
- Position listing (ISIN, description, quantity, price, market value)
- Income received (coupons, maturities)
- Transactions (buys, sells, maturities)
- Cash balance
- Margin utilization (if leveraged)
- Performance (total return, duration, yield)

---

## Common Misconception

"Straight-through processing eliminates operational risk." STP reduces manual errors but introduces technology risk (system outage, incorrect auto-matching rules). Hybrid approach (auto-STP with exception queue for human review) is safer.

## Key Takeaways
- Trade life cycle: execution → confirmation → settlement
- Prime brokerage: financing, leverage, securities lending
- Bond margin lower than equities (2-10% Treasuries, 10-30% HY)
- TRACE/MSRB: mandatory trade reporting
- Operational risk: trade errors, settlement fails, SSI fraud
- Leverage amplifies returns and risk — margin calls when prices fall
- STP (straight-through processing) reduces operational risk

---

## Feynman Explain
Explain prime brokerage to a client: "How does a hedge fund get leverage to buy $500M of bonds with only $100M?" Use mortgage analogy — cash down payment = margin, loan = repo financing.

*Self-check: Can you explain why operational risk is higher in OTC bond trading vs exchange-traded equities?*

Run: `./scripts/learn.sh explain fixed-income 15-brokerage-operations-for-fixed-income`

---

## Reframe
Critique prime brokerage leverage: "Do prime brokers contribute to systemic risk?" Consider: LTCM 1998, Archegos 2021, collateral fire sales. What regulations address this? Write your answer.

---

## Drill
Take the quiz.

Run: `./scripts/learn.sh quiz fixed-income 15-brokerage-operations-for-fixed-income`

## Quiz: 15-brokerage-operations-for-fixed-income


### Which phase follows trade execution in the trade life cycle?

- [ ] A: Settlement

- [✓] B: Trade capture and confirmation

- [ ] C: Margin call

- [ ] D: Reporting


**Answer:** B

Execution → capture → confirmation/affirmation → clearing → settlement.


### Prime brokerage provides all EXCEPT:

- [ ] A: Financing (repo)

- [ ] B: Securities lending

- [✓] C: Credit rating

- [ ] D: Custody and settlement


**Answer:** C

Prime brokers provide financing, lending, custody, execution. Credit ratings are from rating agencies.


### Typical initial margin requirement for Treasury bonds:

- [ ] A: 50%

- [✓] B: 2-10%

- [ ] C: 20-30%

- [ ] D: 0%


**Answer:** B

Treasuries: low volatility, high liquidity → low margin (2-10%). HY corporates: 10-30%.


### Margin call triggers when:

- [ ] A: Interest rates fall

- [✓] B: Equity falls below maintenance margin requirement

- [ ] C: Bond matures

- [ ] D: Client requests withdrawal


**Answer:** B

If equity/position value drops below maintenance requirement → broker demands more cash/securities.


### TRACE requires corporate bond trade reporting within:

- [ ] A: 1 hour

- [✓] B: 15 minutes

- [ ] C: End of day

- [ ] D: Next business day


**Answer:** B

TRACE: report within 15 minutes of trade execution. Dramatically increased post-trade transparency.


### SSI fraud involves:

- [ ] A: Trading fake bonds

- [✓] B: Criminals changing settlement instructions to divert payments

- [ ] C: Insider trading

- [ ] D: Market manipulation


**Answer:** B

SSI fraud: hackers send fake instructions → settlement payment goes to attacker's account. Major operational risk.


### Private bank client: $50M bonds, $10M equity. Current leverage?

- [ ] A: 2x

- [✓] B: 5x

- [ ] C: 10x

- [ ] D: 50x


**Answer:** B

Leverage = total position / equity = $50M / $10M = 5x


### If bond position falls 5% and equity was $10M on $50M position, new leverage?

- [ ] A: 4.75x

- [✓] B: 5.26x

- [ ] C: 5.0x

- [ ] D: 6.0x


**Answer:** B

New position = $47.5M. Loss = $2.5M. Equity = $10M - $2.5M = $7.5M. Leverage = $47.5M / $7.5M = 5.26x


### STP (Straight-Through Processing) reduces:

- [ ] A: Credit risk

- [✓] B: Operational risk (manual errors, delays)

- [ ] C: Interest rate risk

- [ ] D: Market risk


**Answer:** B

STP automates trade processing end-to-end. Reduces manual intervention, errors, settlement fails.


### Archegos 2021 collapse highlighted risk of:

- [ ] A: Sovereign default

- [✓] B: Concentrated leverage through prime brokers without proper risk controls

- [ ] C: Treasury settlement fails

- [ ] D: Muni bond default


**Answer:** B

Archegos: concentrated, levered total return swaps. Prime brokers failed to monitor aggregate exposure → forced liquidation.


---

# Module 16: Fixed Income Options

## Core Content

### Bond Options vs Equity Options

| Feature | FI Options | Equity Options |
|---------|-----------|----------------|
| Underlying | Bond price, yield, or interest rate | Stock price |
| Exercise style | Mostly American (callable bonds) | American or European |
| Volatility | Changes with time to maturity | Relatively constant |
| Delivery | Physical bond or cash settlement | Shares or cash |
| Liquidity | OTC, less liquid | Exchange-traded, more liquid |

### Types of Embedded FI Options

**Callable Bond**: Issuer right to redeem before maturity at call price
- Issuer exercises when rates fall (refinance cheaper)
- Investor receives call premium + principal
- Negative convexity near call date

Question: Why would any investor buy a callable bond if upside is capped? Answer: Higher coupon vs non-callable. Callable bond yield = non-callable yield + option premium. Investor gets paid for taking call risk.

**Putable Bond**: Investor right to sell back before maturity at par
- Investor exercises when rates rise (reinvest higher)
- Puts a floor on bond price

**Convertible Bond**: Investor right to convert bond into equity shares
- Conversion ratio: shares per bond
- Conversion price: par / conversion ratio
- Conversion value: stock price × conversion ratio
- Parity: bond price relative to conversion value

**Sinkable Bond**: Mandatory partial redemption via sinking fund
- Can have embedded option to accelerate payments
- Reduces credit risk over time

### Interest Rate Options

| Option | Description | Payoff |
|--------|-------------|--------|
| Cap | Call on interest rate (ceiling on floating rate) | max(rate - strike, 0) × notional × period |
| Floor | Put on interest rate (floor on floating rate) | max(strike - rate, 0) × notional × period |
| Collar | Cap + Floor combined | Caps cost + sets minimum |
| Swaption | Option to enter an interest rate swap | Payer swaption (pay fixed) / Receiver swaption (receive fixed) |

### Bond Option Pricing

**Key variables**:
- Current bond price / yield
- Strike price / yield
- Time to expiration
- Risk-free rate
- Yield volatility
- Coupon payments during option life

**Black Model for bond options**:
```
Call = B × N(d1) - K × e^(-rT) × N(d2)
Put = K × e^(-rT) × N(-d2) - B × N(-d1)
```

Where B = forward bond price, K = strike, r = risk-free rate, T = time

**Limitations**:
- Bond price converges to par at maturity (pull-to-par)
- Yield volatility not constant over time
- Negative convexity distorts pricing near call dates

### Yield-Based vs Price-Based Options

| Metric | Yield-Based | Price-Based |
|--------|-------------|-------------|
| Underlying | Yield to maturity | Dollar price |
| Strike | Yield level | Price level |
| Sensitivity | DV01-based | Duration-based |
| Convention | Used for caps/floors/swaptions | Used for bond options |

### Private Bank Context

High-net-worth clients use FI options for:
- **Portfolio protection**: Buying put options or swaptions to hedge rising rates
- **Yield enhancement**: Writing covered calls on bond positions (risk: bond called away)
- **Structured products**: Capital-guaranteed notes using zero-coupon bonds + options
- **Mortgage hedge**: Using caps to limit floating-rate mortgage costs for private banking real estate lending

Private banks structure bespoke OTC options for clients, including:
- Range accrual notes: Coupon paid only when reference rate stays within range
- Callable / putable structured notes: Customized strike and tenor
- Yield enhancement via option writing against bond portfolios

## Common Misconception

"Callable bond = higher yield = always better." Higher yield compensates for capped upside. In rate rally, callable bond underperforms. Investor must decide: get paid for call risk or avoid it with non-callable at lower yield.

## Key Takeaways

- Embedded options fundamentally change bond price-yield relationship
- Callable bonds = long bond + short call option → negative convexity
- Putable bonds = long bond + long put option → price floor
- Interest rate caps/floors/floors are OTC options on floating rates
- Black model used for pricing despite limitations
- Private banks use FI options for protection, yield enhancement, structured products

## Feynman Explain

Explain how callable bonds differ from straight bonds in terms of price behavior when interest rates fall. Why does the call option become valuable to the issuer when rates decline? What happens to the bond's price sensitivity near the call date?

## Reframe

Some investors avoid callable bonds because of reinvestment risk during falling rate environments. Yet callable bonds typically offer higher coupons than comparable non-callable bonds. Under what market conditions does the additional coupon adequately compensate for the call risk? When does it not?

## Drill

Answer the quiz questions for this module to test your understanding of FI options.

## Quiz: 16-fixed-income-options

(quiz parse error: while scanning a block scalar
  in "./subjects/fixed-income/modules/16-fixed-income-options/quiz.yaml", line 42, column 8
expected chomping or indentation indicators, but found 'R'
  in "./subjects/fixed-income/modules/16-fixed-income-options/quiz.yaml", line 42, column 9)


---

# Module 17: Fixed Income Portfolio Strategies

## Core Content

### Active vs Passive Strategies

| Strategy | Approach | Goal | Example |
|----------|----------|------|---------|
| Passive | Buy and hold / index replication | Match benchmark, minimize tracking error | Replicate Bloomberg Aggregate Bond Index |
| Active | Tactical duration / credit / sector tilts | Beat benchmark | Overweight 10yr if rates expected to fall |
| Enhanced indexing | Minor active tilts around passive core | +25-50bps over index | Slight overweight to corporate bonds |
| Liability-driven (LDI) | Match asset cash flows to liabilities | Fund known future obligations | Pension fund matching duration to liabilities |

### Passive Strategies

**Buy and Hold**: Purchase bonds, hold to maturity
- No transaction costs after initial purchase
- Reinvestment risk on coupons
- Credit migration risk
- Best for: insurance companies, pension funds with known liabilities

**Indexing**: Replicate bond index returns
- Full replication: buy all securities (impractical for broad indices)
- Stratified sampling: bucket by sector/duration/credit, buy representative bonds
- Optimization-based: minimize tracking error given constraints

**Challenges with bond indexing**:
- Thousands of securities in broad indices
- Many bonds illiquid or hard to source
- Bonds mature and fall out of index (turnover)
- Index composition changes monthly
- Tracking error inevitable

### Active Strategies

| Strategy | Description | Rate View |
|----------|-------------|-----------|
| Duration tilting | Over/underweight portfolio duration vs benchmark | Bullish = long duration; bearish = short duration |
| Yield curve positioning | Bullet / barbell / ladder relative to benchmark | Steepener / flattener / butterfly |
| Sector rotation | Overweight sectors expected to outperform | Cyclical vs defensive |
| Credit allocation | Over/underweight credit quality buckets | Risk-on vs risk-off |
| Security selection | Pick individual bonds with mispriced risk | Bottom-up credit analysis |

Question: Which strategy wins in steepening, flattening, and stable environments? Answer: Bullet wins steepening (concentrated at long end benefits from rising long rates). Barbell wins flattening (short end stable, long end rallies). Ladder wins stable (constant reinvestment, no timing risk).

**Bullet Strategy**: Concentrate maturities in single range
- Used when curve expected to steepen
- Reduces reinvestment risk horizon

**Barbell Strategy**: Concentrate in short + long maturities, skip intermediate
- Used when curve expected to flatten
- Higher convexity than bullet with same duration
- More liquidity from short end

**Ladder Strategy**: Equal weights across evenly spaced maturities
- Natural diversification
- Constant reinvestment at current rates
- Low maintenance, predictable cash flows

### Liability-Driven Investing (LDI)

**Core concept**: Manage assets relative to liability value, not index

**Key metrics**:
- **Funding ratio**: Assets / Present value of liabilities
- **Surplus**: Assets - PV(liabilities)
- **Duration gap**: Asset duration - Liability duration

**Strategies**:
- Cash flow matching: Buy bonds matching liability payment schedule exactly
- Duration matching: Match asset/liability duration (immunization)
- Convexity matching: Also match second derivative for larger rate moves
- Swaps/derivatives: Use interest rate swaps to adjust duration without buying/selling bonds

**Immunization**: Set portfolio duration = liability horizon, ensure PV of assets = PV of liabilities
- Requires rebalancing as time passes and duration drifts
- Works best for parallel yield curve shifts

### Bond Portfolio Risk Management

| Risk | Source | Management |
|------|--------|------------|
| Interest rate | Yield curve movements | Duration/convexity hedging with futures/swaps |
| Credit spread | Widening/narrowing of spreads | CDS hedging, diversification |
| Default | Issuer bankruptcy | Diversification, credit analysis |
| Reinvestment | Coupon reinvested at lower rates | Cash flow matching, ladder |
| Liquidity | Unable to sell at fair price | Hold liquid securities, line of credit |
| Prepayment | MBS called early | Prepayment models, PO/IO tranches |
| Currency (if global) | FX rate changes | FX forwards, currency hedged ETFs |

### Yield Enhancement Strategies

- **Carry trade**: Borrow short-term, lend long-term (positive carry if curve upward sloping)
- **Credit barbell**: Short IG + long HY to increase yield while managing duration
- **Emerging market debt**: Higher yields with currency risk
- **Leverage**: Repo borrowing to finance additional bond purchases
- **Option writing**: Sell covered calls on bond positions or write swaptions

### Private Bank Context

Wealth management clients invest in bond portfolios for:
- **Income generation**: Regular coupon payments for spending needs
- **Capital preservation**: High-quality bonds as safe haven
- **Diversification**: Low correlation with equities
- **Legacy planning**: Long-dated bonds for estate planning

Portfolio construction considerations for HNW clients:
- Tax-efficient bond placement (munis in taxable accounts, corporates in tax-deferred)
- Customized bond ladders for predictable cash flows
- Direct bond ownership vs bond funds/ETFs (fee efficiency)
- ESG/sustainable bond integration per client preferences
- Duration management aligned with spending horizon

## Common Misconception

"Immunization eliminates interest rate risk." Only true for parallel shifts. Non-parallel shifts (steepening/flattening) break immunization. Requires convexity matching or key-rate hedging for true rate risk elimination.

## Key Takeaways

- Passive strategies (buy & hold, indexing) minimize cost and tracking error
- Active strategies (duration tilting, curve positioning, sector rotation) seek alpha
- Barbell has higher convexity than bullet at same duration
- LDI aligns assets with liabilities for pension funds/insurance
- Private bank clients prioritize income, preservation, and tax efficiency

## Feynman Explain

Explain the difference between a bullet, barbell, and ladder bond portfolio strategy. When would each be preferred in terms of yield curve expectations?

## Reframe

Critics argue that active bond management rarely beats passive indexing after fees, given bond markets are more efficient than equity markets. Yet sophisticated investors still allocate to active bond managers. What specific market inefficiencies in fixed income (vs equities) could skilled managers exploit? Consider liquidity, institutional constraints, and segmentation.

## Drill

Answer the quiz questions for this module to test your understanding of FI portfolio strategies.

## Quiz: 17-fi-portfolio-strategies


### Portfolio with maturities concentrated in short + long maturities, skipping intermediate:

- [ ] A: Bullet

- [✓] B: Barbell

- [ ] C: Ladder

- [ ] D: Immunization


**Answer:** B

Barbell has short and long maturities, no intermediate. Higher convexity than bullet at same duration.


### Funding ratio is defined as:

- [✓] A: Assets / Present value of liabilities

- [ ] B: PV(liabilities) / Assets

- [ ] C: Duration assets / Duration liabilities

- [ ] D: Coupon income / Total return


**Answer:** A

Funding ratio = Assets / PV(Liabilities). &gt;1 means overfunded, &lt;1 means underfunded.


### Manager expects yield curve to steepen. Which strategy is likely preferred?

- [ ] A: Barbell (short + long maturities)

- [✓] B: Bullet (concentrated intermediate maturities)

- [ ] C: Index replication

- [ ] D: Cash flow matching


**Answer:** B

Bullet concentrated in intermediate range avoids both short end (falling yield = price gain missed) and long end (rising yield = price loss). Preferred when curve steepening expected.


### Key challenge unique to bond indexing (vs equity indexing):

- [ ] A: High management fees

- [✓] B: Bonds mature and fall out of index, creating turnover

- [ ] C: Dividends complicate total return calculation

- [ ] D: No benchmark available


**Answer:** B

Bonds constantly mature and are replaced, creating ongoing turnover not present in equity indices.


### Immunization strategy aims to:

- [✓] A: Match asset duration to liability horizon

- [ ] B: Maximize total return regardless of risk

- [ ] C: Eliminate all credit risk from portfolio

- [ ] D: Achieve highest possible convexity


**Answer:** A

Immunization sets portfolio duration = liability horizon so price risk and reinvestment risk offset.


### Ladder strategy primary advantage:

- [ ] A: Highest convexity of any strategy

- [✓] B: Predictable cash flows with constant reinvestment

- [ ] C: Best performance in falling rate environments

- [ ] D: Zero tracking error vs benchmark


**Answer:** B

Ladder provides predictable cash flows as bonds mature at regular intervals, with constant reinvestment at current rates.


### HNW client in high tax bracket wants bond income. Which approach is best?

- [ ] A: High-yield corporate bonds in taxable account

- [✓] B: Municipal bonds in taxable account

- [ ] C: Treasury bonds in IRA

- [ ] D: REITs in taxable account


**Answer:** B

Municipal bonds are tax-exempt at federal level, ideal for taxable accounts of high-tax-bracket investors.


### Carry trade in fixed income means:

- [ ] A: Buying bonds with highest coupon regardless of maturity

- [✓] B: Borrowing short-term to invest in longer-term bonds

- [ ] C: Selling CDS protection on investment grade names

- [ ] D: Leveraging with options on bond futures


**Answer:** B

Carry trade = borrow short (low rate), lend long (higher yield), profit from positive carry if curve upward sloping.


### Surplus of a pension fund changes most directly with:

- [ ] A: Stock market performance only

- [✓] B: Changes in interest rates affecting both assets and liabilities

- [ ] C: Credit rating of the plan sponsor

- [ ] D: Dividend yield on equity holdings


**Answer:** B

Interest rates affect both bond asset values and PV of liabilities (discount rate). Surplus = Assets - PV(Liabilities).


### Why does barbell strategy have higher convexity than bullet at same duration?

- [ ] A: Short maturity bonds have zero convexity

- [✓] B: Long maturity bond's convexity dominates the portfolio

- [ ] C: Duration calculation is inaccurate for barbell

- [ ] D: Intermediate bonds have highest convexity


**Answer:** B

Convexity increases with maturity squared. Long maturity bond in barbell contributes outsized convexity relative to its weight.


---

# Module 18: Regulatory Environment

## Core Content

### Major Regulatory Frameworks

| Regulation | Jurisdiction | Key Impact on FI Markets |
|-----------|-------------|--------------------------|
| Dodd-Frank Act (2010) | US | Mandatory clearing, swap execution facilities (SEFs), trade reporting |
| MiFID II / MiFIR (2018) | EU | Pre/post-trade transparency, systematic internalisers, best execution |
| EMIR (2012) | EU | Derivatives clearing, risk mitigation, reporting to trade repositories |
| Basel III | Global | Bank capital/liquidity requirements, leverage ratio, NSFR/LCR |
| SEC Rule 2a-7 | US | Money market fund reform, floating NAV, liquidity fees/redemption gates |

### Dodd-Frank Wall Street Reform and Consumer Protection Act

**Title VII — Wall Street Transparency and Accountability**:
- **Clearing mandate**: Standardized OTC derivatives must clear through CCPs
- **Swap Execution Facilities (SEFs)**: Electronic platforms for swap trading
- **Trade reporting**: All swaps reported to swap data repositories (SDRs)
- **Margin requirements**: Non-cleared swaps subject to initial and variation margin
- **Real-time price transparency**: Pre/post-trade transparency for swaps

**Impact on FI markets**:
- CDS trading moved from voice to electronic (SEFs)
- Bilateral margin calls increased collateral demand
- Higher costs for bespoke/uncleared derivatives
- Reduced liquidity in some exotic products

### MiFID II / MiFIR

**Transparency requirements**:
| Bond Type | Pre-Trade | Post-Trade |
|-----------|-----------|------------|
| Government bonds | Firm quotes for specific sizes | Within 15 min (delayed for large) |
| Corporate bonds | Indicative quotes | Within 15 min |
| Structured products | Limited transparency | End of day |

**Key concepts**:
- **Systematic Internaliser (SI)**: Firm that deals on own account, organized, frequent, systematic — must provide firm quotes
- **Best execution**: Firms must take all sufficient steps to obtain best possible result
- **Double volume cap**: Limits on trading under waiver from pre-trade transparency
- **Bond liquidity assessments**: Periodic review of liquidity tiers for deferral eligibility

### EMIR (European Market Infrastructure Regulation)

- **Clearing obligation**: Standardized OTC derivatives cleared through CCPs
- **Reporting**: All derivatives reported to trade repositories
- **Risk mitigation**: Timely confirmation, portfolio reconciliation, dispute resolution
- **Bilateral margin**: Non-cleared derivatives subject to variation margin + initial margin
- **LEI requirement**: Legal Entity Identifier for all counterparties

### Basel III — Bank Capital and Liquidity

Why Basel III? Pre-2008 banks held too little capital vs risk. A $100B trading book needed only ~$1B capital. When markets crashed, losses exceeded capital → bailouts. Basel III raised capital requirements by 3-5x for trading books.

**Capital requirements for bond inventory**:
| Metric | Requirement | Impact |
|--------|-------------|--------|
| Leverage Ratio (LR) | 3% Tier 1 / exposure | Limits balance sheet for bond inventory |
| Liquidity Coverage Ratio (LCR) | HQLA ≥ 30-day net cash outflows | Bank demand for high-quality bonds |
| Net Stable Funding Ratio (NSFR) | Available stable funding ≥ Required stable funding | Penalty for long-dated bond holdings with short-term funding |
| Supplementary Leverage Ratio (SLR) | Enhanced leverage ratio for GSIBs | Constrains repo and securities lending |

**Consequences for FI markets**:
- Reduced dealer balance sheet capacity → higher bid-ask spreads
- LCR created structural demand for Treasuries (HQLA)
- NSFR disincentivizes long-dated bond financing with short-term repo
- Repo market affected by leverage ratio constraints (especially at quarter-end)

### SEC Money Market Fund Reform

**Rule 2a-7 changes (2014/2023)**:
- Prime institutional MMFs must have floating NAV (not constant $1)
- Liquidity fees (up to 2%) and redemption gates can be imposed
- Increased minimum liquidity requirements (30% weekly liquid assets)
- 2023 amendment: Swing pricing mandatory for prime institutional MMFs

**Impact**: Shift from prime MMFs to government MMFs, affecting repo and short-term credit markets

### Market Oversight Bodies

| Body | Jurisdiction | Role in FI Markets |
|------|-------------|-------------------|
| SEC | US | Securities regulation, bond market structure, disclosure |
| FINRA | US | Self-regulatory, TRACE reporting, exam/enforcement |
| MSRB | US | Municipal securities rulemaking |
| CFTC | US | Derivatives (swaps, futures) oversight |
| ESMA | EU | Securities markets regulator, MiFID II enforcement |
| ECB | EU | Monetary policy, bond purchases (PEPP, PSPP) |
| BOE/FCA | UK | Prudential regulation / conduct authority |
| IOSCO | Global | International standards coordination |

### Basel Endgame (US Proposal, 2023)

**Proposed changes**:
- Higher risk weights for trading book (FRTB — Fundamental Review of the Trading Book)
- Increased operational risk capital
- Revised credit valuation adjustment (CVA) framework
- Binding leverage ratio constraint for largest banks

**Potential market impact**:
- Further reduced dealer bond inventory capacity
- Higher costs for securitization exposures
- Incentive for banks to exit certain FI businesses (commo, some structured products)

### Regulatory Reporting for Private Banks

**When advising clients on FI positions**:
- **FATCA**: Reporting US securities held by foreign clients
- **CRS (Common Reporting Standard)**: Automatic exchange of client account information
- **EMIR reporting**: Derivative transaction reporting obligation
- **MiFID II**: Client categorization (retail/professional/eligible counterparty), suitability, reporting
- **Dodd-Frank**: Swap dealer registration if crossing certain thresholds

### Private Bank Context

Regulatory compliance affects private banking bond operations:
- Client suitability assessment before bond recommendations
- Best execution obligations on fixed income trades
- Reporting of derivative positions (EMIR, Dodd-Frank)
- FATCA/CRS compliance for cross-border bond holdings
- Know-your-customer (KYC) documentation for bond account opening
- Capital charges on structured note inventory
- Liquidation of client US bond holdings must comply with US/EU cross-border rules (e.g., reverse solicitation)

## Common Misconception

"More regulation = safer markets." Regulation reduces systemic risk but creates unintended consequences. Basel III → less dealer inventory → wider bid-ask spreads → lower liquidity for clients in stress. Trade-off between stability and market function.

## Key Takeaways

- Dodd-Frank pushed OTC derivatives to central clearing and SEF trading
- MiFID II increased bond market transparency with pre/post-trade requirements
- Basel III constraints reduce dealer balance sheet capacity, affecting liquidity
- MMF reform shifted money market assets from prime to government funds
- Banks face increasing capital charges for bond inventory and derivatives
- Private banks must navigate cross-border reporting and suitability rules

## Feynman Explain

Explain how Basel III's Liquidity Coverage Ratio (LCR) created a structural increase in demand for government bonds. Why do banks hold more Treasuries now than before 2008? Trace the mechanism from regulation to market impact.

## Reframe

Regulatory costs reduce market liquidity, yet regulations exist because of market failures exposed by the 2008 crisis. Is the optimal regulatory regime the one that maximizes market liquidity, or the one that ensures financial stability even at a cost to liquidity? Consider the trade-off between dealer capacity and systemic risk reduction.

## Drill

Answer the quiz questions for this module to test your understanding of regulatory environment.

## Quiz: 18-regulatory-environment


### Which regulation mandates central clearing of standardized OTC derivatives in the US?

- [ ] A: MiFID II

- [✓] B: Dodd-Frank Act Title VII

- [ ] C: EMIR

- [ ] D: Basel III


**Answer:** B

Dodd-Frank Title VII requires standardized OTC derivatives to clear through CCPs and trade on SEFs.


### Basel III liquidity rule requiring banks to hold enough HQLA to cover 30-day net cash outflows:

- [ ] A: NSFR

- [✓] B: LCR

- [ ] C: SLR

- [ ] D: FRTB


**Answer:** B

LCR = High Quality Liquid Assets / 30-day net cash outflows ≥ 100%. Created structural demand for Treasuries.


### Under MiFID II, post-trade transparency for corporate bonds must be reported:

- [ ] A: Instantaneously

- [✓] B: Within 15 minutes

- [ ] C: End of day

- [ ] D: Within 3 business days


**Answer:** B

MiFID II requires post-trade transparency within 15 minutes for corporate bonds (deferrals available for large trades).


### SEC Rule 2a-7 2014 reform required prime institutional money market funds to:

- [ ] A: Close all new investments

- [✓] B: Use floating Net Asset Value (NAV)

- [ ] C: Invest only in Treasuries

- [ ] D: Maintain 100% daily liquid assets


**Answer:** B

Reform required prime institutional MMFs to abandon $1 constant NAV for floating NAV.


### How does Basel III Supplementary Leverage Ratio (SLR) affect repo markets?

- [ ] A: Increases repo borrowing capacity

- [✓] B: Constrains bank repo activity by limiting leverage on balance sheet

- [ ] C: Reduces haircut requirements

- [ ] D: Mandates CCP clearing for all repo


**Answer:** B

SLR limits bank leverage including repo book; banks reduce repo activity (especially at quarter-end) to stay under SLR constraints.


### Which body oversees municipal bond market regulation?

- [ ] A: SEC

- [ ] B: FINRA

- [✓] C: MSRB

- [ ] D: CFTC


**Answer:** C

MSRB (Municipal Securities Rulemaking Board) regulates municipal securities market.


### EMIR reporting obligation applies to:

- [ ] A: All securities trades

- [✓] B: All derivative transactions

- [ ] C: Only credit default swaps

- [ ] D: Only exchange-traded futures


**Answer:** B

EMIR requires all OTC and exchange-traded derivatives to be reported to trade repositories.


### MiFID II Systematic Internaliser (SI) designation requires a firm to:

- [ ] A: Internalize all client trades

- [✓] B: Provide firm quotes to clients

- [ ] C: Register as an exchange

- [ ] D: Clear all trades through CCP


**Answer:** B

SI = firm dealing on own account in organized/frequent/systematic way. Must publish firm quotes and be executable.


### Private bank must assess client knowledge and experience before recommending bonds under:

- [ ] A: EMIR

- [✓] B: MiFID II suitability requirements

- [ ] C: Dodd-Frank Volcker Rule

- [ ] D: Basel III Pillar 2


**Answer:** B

MiFID II requires suitability assessment: match investment recommendation to client knowledge, experience, risk tolerance.


### Which regulation requires automatic exchange of client account information across jurisdictions for tax purposes?

- [ ] A: FATCA

- [ ] B: CRS

- [✓] C: Both FATCA and CRS

- [ ] D: Dodd-Frank Section 1502


**Answer:** C

FATCA (US) and CRS (global/OECD) both require automatic exchange of client financial account information for tax compliance.


---


---

# Module 19: Private Bank Wealth Management & Fixed Income

## Core Content

### Fixed Income Role in Wealth Management

| Client Need | Fixed Income Solution | Typical Allocation |
|-------------|----------------------|-------------------|
| Capital preservation | Short-duration Treasuries, agency MBS | 20-40% |
| Income generation | Corporate bonds, munis, preferreds | 15-30% |
| Portfolio diversification | Multi-sector bond exposure | 10-25% |
| Liability matching | Duration-matched bonds | Varies by situation |
| Tax efficiency | Municipal bonds, tax-advantaged structures | HNW: 20-50% of FI allocation |
| Inflation protection | TIPS, floating-rate notes | 5-15% |
| Growth | High-yield bonds, EM debt, convertible bonds | 5-15% |

### Client Segmentation and Bond Strategies

**Mass Affluent ($250k-$1M)**:
- Primarily bond funds/ETFs (efficient access, diversification)
- Limited direct bond holdings (typically Treasuries via brokerage)
- Focus: simplicity, low cost, tax efficiency

**High Net Worth ($1M-$30M)**:
- Mix of direct bonds and funds/ETFs
- Customized municipal bond ladders
- Individual corporate bonds held to maturity
- Separate managed accounts (SMAs) with bond managers
- Structured notes for tailored risk/return

**Ultra High Net Worth ($30M+)**:
- Direct bond portfolios with dedicated managers
- Private placements (Rule 144A bonds)
- Bespoke structured products
- Family office manages bond allocation in-house
- Direct participation in bond syndications
- Collateralized lending against bond portfolios

Question: Why do UHNW clients hold bonds directly instead of funds? Answer: Control over maturity (avoid forced selling), tax-loss harvesting at individual bond level, customization of cash flows, and no management fees.

### Tax-Aware Bond Investing

| Bond Type | Federal Tax | State/Local Tax | Best Account Location |
|-----------|-------------|-----------------|----------------------|
| Treasuries | Taxable | Exempt state/local | Taxable account |
| Agency bonds | Taxable | Taxable | Tax-deferred (IRA) |
| Municipal bonds (in-state) | Tax-exempt | Tax-exempt | Taxable account |
| Municipal bonds (out-of-state) | Tax-exempt | Taxable in-state | Taxable account |
| Corporate bonds | Taxable | Taxable | Tax-deferred (IRA) |
| TIPS | Taxable (phantom income) | Exempt state/local | Tax-deferred if possible |
| High-yield bonds | Taxable | Taxable | Tax-deferred (IRA) |

**Tax-equivalent yield**:
```
TEY = Municipal Yield / (1 - Federal Tax Rate - State Tax Rate)
```

**Tax-loss harvesting**: Sell bonds at loss to offset gains, replace with similar (not substantially identical) bonds
- Must avoid wash sale rule (30-day window)
- More opportunities in volatile bond markets
- Municipal bond swaps common for tax-loss harvesting

### Structured Products for Private Clients

| Product | Description | FI Link |
|---------|-------------|---------|
| Principal-protected note | Zero-coupon bond + call option on equity/index | Zeros provide principal protection |
| Yield enhancement note | Sell put option + bond, higher coupon if not called | Option premium boosts yield |
| Reverse convertible | High coupon but risk of receiving stock if below barrier | Credit + equity linked |
| Autocallable note | Calls automatically if underlying above trigger | Path-dependent structured coupon |
| Fixed-to-floating note | Fixed coupon period then floats | Rate view expression |

**Risks**: Issuer credit risk, limited liquidity, complexity/transparency, early call risk

### Private Banking Bond Advisory Services

| Service | Description |
|---------|-------------|
| Investment policy statement (IPS) | Define bond allocation, duration range, credit quality limits |
| Liability-driven advice | Structure bond portfolio around client spending/liability needs |
| Credit research | Independent analysis of issuer credit quality |
| Trade execution | Access to primary and secondary bond markets |
| Portfolio reporting | Performance, risk analytics, tax lot reporting |
| ESG integration | Screen bond portfolios for environmental/social/governance factors |
| Collateral management | Use bond portfolio as collateral for lending facilities |

### Bond Portfolio Lending (Securities-Based Lending)

**Mechanism**: Borrow against bond portfolio at preferential rates
- Loan-to-value varies by bond type: Treasuries 90-95%, munis 75-85%, corporates 60-80%, HY 50-60%
- Interest rate typically SOFR + spread
- No forced liquidation unless collateral falls below LTV threshold
- Used for: liquidity without selling bonds, bridge financing, avoiding tax events on sale

**Margin loan vs bond portfolio loan**:
| Feature | Margin Loan (Brokerage) | Bond Portfolio Loan (Private Bank) |
|---------|----------------------|------------------------------------|
| Rate | Higher (broker call rate +) | Lower (SOFR + small spread) |
| LTV | Reg T: 50% for stocks, higher for bonds | Customized per bond type |
| Purpose | Trading | Liquidity, real estate, business |
| Recourse | Recourse | Can be non-recourse |

### Private Client Bond Portfolio Construction

**Step-by-step process**:
1. **Goals and constraints**: Income need, time horizon, tax situation, risk tolerance
2. **Asset allocation**: Determine FI % of total portfolio
3. **Benchmark selection**: Choose reference index (e.g., Bloomberg US Agg, custom benchmark)
4. **Duration positioning**: Align with rate view and liability horizon
5. **Sector allocation**: Treasuries, agencies, corporates, munis, securitized
6. **Credit quality**: Investment grade vs high yield allocation
7. **Security selection**: Direct bonds or funds, individual credit analysis
8. **Implementation**: Build position sizes, stagger purchases, manage liquidity
9. **Monitoring**: Rebalance, credit surveillance, tax-loss harvesting

### Key Considerations for Private Bankers

- **Concentrated positions**: Client may hold large single-stock or company bond position — need diversification
- **Legacy holdings**: Bonds inherited or held for decades with low cost basis
- **Business owner bonds**: Owner-issued debt or guaranteed obligations
- **Multi-jurisdiction**: Clients with residency in multiple countries face cross-border tax/reg issues
- **Art/collectibles as collateral**: Alternative asset-backed lending within bond portfolio context
- **Inheritance planning**: Step-up in cost basis for bonds held at death, bond gifts to family

## Common Misconception

"Bonds = safe, stocks = risky for all clients." For long horizon clients, stocks may be safer (inflation protection, growth). Bonds can be riskier in real terms when yields below inflation. Risk is situational — depends on goals, not asset class label.

## Key Takeaways

- Bond allocation varies by wealth tier: mass affluent use funds, UHNW use direct holdings
- Tax-efficient bond placement critical for private client returns
- Municipal bonds essential for high-tax-bracket clients
- Securities-based lending against bond portfolio provides cheap liquidity
- Structured products deliver customized risk/return but carry issuer and complexity risk
- Private bank bond advisory spans IPS, execution, credit research, reporting

## Feynman Explain

Explain why a high-net-worth client in a high-tax state (e.g., California, New York) would prefer in-state municipal bonds over Treasuries or corporate bonds. Walk through the tax-equivalent yield calculation and account location strategy.

## Reframe

Some advisors argue that ultra-high-net-worth clients should avoid bonds entirely for growth-oriented assets, claiming bond returns are too low to meaningfully impact portfolio outcomes for large wealth bases. Under what conditions does this argument break down? Consider spending needs, volatility management, and the client's definition of wealth preservation.

## Drill

Answer the quiz questions for this module to test your understanding of private bank WM and fixed income.

## Quiz: 19-private-bank-wm


### HNW client in 40% federal + 5% state tax bracket considers 3% in-state muni yield. Tax-equivalent yield?

- [ ] A: 4.00%

- [✓] B: 5.45%

- [ ] C: 3.00%

- [ ] D: 6.38%


**Answer:** B

TEY = 3% / (1 - 0.40 - 0.05) = 3% / 0.55 = 5.45%


### Which bond type should be placed in tax-deferred account (IRA) for optimal tax efficiency?

- [ ] A: In-state municipal bonds

- [✓] B: Corporate bonds

- [ ] C: Treasury bonds

- [ ] D: TIPS


**Answer:** B

Corporate bonds fully taxable; best in tax-deferred accounts. Munis tax-exempt, better in taxable accounts.


### Typical LTV for Treasury bonds in securities-based lending:

- [ ] A: 50-60%

- [ ] B: 60-75%

- [ ] C: 75-85%

- [✓] D: 90-95%


**Answer:** D

Treasuries are highest quality collateral, typically 90-95% LTV in securities-based lending.


### Principal-protected note structure uses which FI instrument for capital guarantee?

- [ ] A: High-yield bond

- [✓] B: Zero-coupon bond

- [ ] C: Floating rate note

- [ ] D: Municipal bond


**Answer:** B

Zero-coupon bond purchased at discount, matures at par = principal guarantee. Remainder invested in options.


### Mass affluent client ($500k) bond allocation most likely via:

- [ ] A: Dedicated bond manager

- [ ] B: Private placements

- [✓] C: Bond ETFs and mutual funds

- [ ] D: Direct syndicate participation


**Answer:** C

Mass affluent clients typically access bonds via funds/ETFs for cost-effective diversification.


### Tax-loss harvesting in bond portfolios must avoid:

- [ ] A: Selling bonds at a gain

- [✓] B: Wash sale within 30 days

- [ ] C: Buying munis in taxable accounts

- [ ] D: Holding bonds to maturity


**Answer:** B

Wash sale rule: cannot repurchase substantially identical security 30 days before or after sale at loss.


### Key difference between margin loan and private bank bond portfolio loan:

- [ ] A: Margin loan has lower interest rate

- [✓] B: Bond portfolio loan typically has lower rate and is customized

- [ ] C: Margin loan is always non-recourse

- [ ] D: Bond portfolio loan has Reg T limits of 50%


**Answer:** B

Private bank bond portfolio loan typically offers lower rates (SOFR + small spread) than margin loans, with customized terms.


### Best bond type for client needing inflation protection in taxable account:

- [ ] A: TIPS in taxable account (phantom income issue)

- [✓] B: I Bonds in taxable account (tax-deferred interest)

- [ ] C: Floating rate notes in IRA

- [ ] D: Municipal bonds in taxable account


**Answer:** B

I Bonds offer inflation protection with tax-deferred interest, ideal for taxable accounts. TIPS create phantom income (tax on inflation adjustment).


### Ultra-high-net-worth client benefit from Rule 144A bond market:

- [ ] A: Guaranteed principal protection

- [✓] B: Access to private placements not available to retail investors

- [ ] C: Better transparency than public bonds

- [ ] D: Lower yields than public bonds


**Answer:** B

Rule 144A bonds are private placements sold to QIBs, offering access to issues not available in public markets.


### When advising multi-jurisdiction client on bond holdings, primary regulatory consideration:

- [ ] A: Basel III capital requirements

- [✓] B: Cross-border reporting (FATCA/CRS) and suitability rules

- [ ] C: SEC Rule 2a-7 compliance

- [ ] D: Swap execution facility access


**Answer:** B

Multi-jurisdiction clients trigger cross-border reporting obligations (FATCA, CRS) and each jurisdiction's suitability/advisory rules.


---


---

# Module 20: Capstone — Bond Portfolio Construction

## Core Content

**Note**: This capstone module synthesizes all prior modules into a portfolio construction exercise. No new concepts — application and integration of knowledge.

### Capstone Scenario

**Client profile**: Private banking client, age 55, $15M investable assets
- **Goal**: Generate $400,000 annual pre-tax income, preserve capital for retirement at 62
- **Risk tolerance**: Moderate (willing to tolerate 5-8% annual volatility in bond portfolio)
- **Tax rate**: 43.4% federal (including NIIT) + 5% state = 48.4% marginal
- **Time horizon**: 7 years to retirement, 30+ year retirement
- **Existing assets**: $5M in equities (diversified), $3M in real estate, $2M in cash
- **Constraints**: Needs liquidity for possible real estate investment in 2-3 years ($1M)
- **Preferences**: ESG-conscious, wants tax efficiency

### Step 1: Determine Bond Allocation

**Total portfolio**: $15M
**Current cash**: $2M (excess liquidity)
**Target FI allocation**: 30-40% of total portfolio ($4.5M-$6M)
**Decision**: $5M bond portfolio (33% of total, within moderate risk profile)

### Step 2: Define Sub-Allocations

| Segment | Allocation | Amount | Rationale |
|---------|-----------|--------|-----------|
| Treasuries (1-5yr) | 15% | $750K | Liquidity buffer, safety |
| Municipal bonds (in-state, ladder 1-10yr) | 35% | $1.75M | Tax-free income, diversification |
| Corporate IG (5-10yr) | 20% | $1M | Yield enhancement |
| Agency MBS | 10% | $500K | Spread product, diversification |
| TIPS (5-10yr) | 10% | $500K | Inflation protection |
| High-yield (short duration 1-3yr) | 5% | $250K | Yield pickup, limited rate risk |
| Cash equivalents (T-bills, MMF) | 5% | $250K | Dry powder for opportunity |

### Step 3: Duration Positioning

Question: Why short duration if rates may rise only 50-75bp? Answer: Duration 4.5 → 75bp rise → -3.4% loss. For $5M portfolio, -$170K. Short duration tilts reduce to ~-$100K. Small rate views → large P&L through duration leverage.

**Rate view**: Moderately bearish (yields may rise 50-75bps over next 12 months)
**Strategy**: Short-to-intermediate duration bias

| Metric | Portfolio Target | vs Benchmark (Bloomberg Agg) |
|--------|-----------------|------------------------------|
| Effective duration | 4.5 years | 1.5 years short |
| Average maturity | 6 years | 2 years short |
| Convexity | 0.40 | Slightly positive |

**Implementation**: Weight short-dated munis/Treasuries, avoid long corporates

### Step 4: Income Projection

| Segment | Yield (est.) | Annual Income |
|---------|-------------|--------------|
| Treasuries | 4.5% | $33,750 |
| Munis (tax-equiv 5.2%, actual 2.7%) | 2.7% (tax-free) | $47,250 |
| Corporate IG | 5.2% | $52,000 |
| Agency MBS | 5.0% | $25,000 |
| TIPS | 4.3% (real yield 1.8% + inflation) | $21,500 |
| High-yield | 7.5% | $18,750 |
| Cash equivalents | 5.0% | $12,500 |
| **Total** | | **$210,750 pre-tax** |
| Plus tax savings from munis (vs taxable equivalent) | | ~$44,000 |
| **Adjusted income including tax benefit** | | **~$255,000** |

Gap to $400K target: remaining income from equity dividends, real estate cash flow

### Step 5: Risk Management

| Risk | Mitigation |
|------|-----------|
| Interest rate rise | Short duration tilt, floating rate allocation |
| Credit downgrade | Diversification across 30+ issuers, IG focus |
| Default | Maximum 3% per issuer, avoid concentrated names |
| Reinvestment risk | Ladder structure provides rolling reinvestment |
| Inflation | TIPS allocation, some floating rate |
| Liquidity | Treasury/Cash buffer for real estate needs |
| Call risk | Avoid callable agency bonds, select make-whole corporates |
| Prepayment | Agency MBS allocation limited to 10% |

### Step 6: Implementation Plan

| Phase | Action | Timing |
|-------|--------|--------|
| 1 | Deploy $250K cash into T-bills | Immediate |
| 2 | Build muni ladder: $175K/year across 1-10yr | Over 2 months |
| 3 | Select 5-8 corporate IG bonds | Over 3 months |
| 4 | Add agency MBS via specified pools | Over 1 month |
| 5 | Place TIPS auction orders | Next 3 auctions |
| 6 | High-yield via short-duration ETF | Immediate |
| 7 | Rebalance duration to target | After all positions |

### Step 7: Monitoring and Rebalancing

| Frequency | Action |
|-----------|--------|
| Monthly | Performance vs benchmark, income tracking |
| Quarterly | Credit review of each holding, rating changes |
| Semi-annual | Duration rebalancing, sector allocation check |
| Annual | IPS review, rebalance to targets |
| Event-driven | Significant yield curve moves, credit events, client life changes |

### Portfolio Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Total return vs benchmark | Within 50bps (moderate active risk) | Bloomberg Agg + custom muni index |
| Income stability | Within 10% of projection | Actual vs projected coupon income |
| Credit quality | Average A or higher | S&P/Moody's weighted average |
| Tax efficiency ratio | >90% | Taxable-equivalent return / actual return |
| Tracking error | <100bps | Annualized standard deviation of excess returns |
| Worst drawdown | <8% | Peak-to-trough in value |

### Private Bank Platform Resources

**For executing this portfolio**:
- **Bond trading desk**: Access primary and secondary markets
- **Credit research team**: Independent analysis on each issuer
- **Tax advisory**: Municipal bond selection for state tax optimization
- **Reporting**: Consolidated view across all holdings
- **Collateral lending**: Securities-based lending against portfolio
- **Estate planning**: Bond titling for trust/estate purposes
- **Alternative investments**: If higher yield needed, private credit allocation

### Key Portfolio Construction Lessons

1. **Start with client goals, not market views**: IPS before strategy
2. **Tax efficiency matters more than yield**: For taxable clients, after-tax return is what counts
3. **Duration positioning dominates returns**: Gets ~90% of bond portfolio variation
4. **Credit diversification over concentration**: Single-name default risk
5. **Liquidity is a feature, not a constraint**: Proper liquidity buffer avoids forced selling
6. **Ladder for income, barbell for convexity**: Strategy choice driven by client needs
7. **Monitor drawdown, not just yield**: Capital preservation is paramount for private clients
8. **Bonds are not risk-free**: Understand all risks (rate, credit, liquidity, inflation, reinvestment, prepayment)

## Key Takeaways

- Bond portfolio construction integrates all prior modules: pricing, duration, convexity, credit, tax, regulation
- Client-first approach: IPS guides all decisions
- Tax efficiency, income stability, capital preservation — private bank bond priorities
- Duration positioning is the dominant performance driver
- Proper risk management prevents forced selling at inopportune times
- Portfolio requires ongoing monitoring and periodic rebalancing

## Feynman Explain

Walk through the entire bond portfolio construction process for a HNW client from start to finish. Explain why each step matters and how a change in any assumption (e.g., higher inflation, lower tax rates, earlier retirement) would cascade through the construction process.

## Reframe

The case against bonds in private client portfolios: "With yields barely above inflation after tax, why bother? Clients would be better served by a diversified equity portfolio and cash buffer." Construct the counter-argument using wealth management principles: sequence-of-returns risk, spending needs, and capital preservation. Where is the critic right, and where are they wrong?

## Drill

Answer the quiz questions for this module. These questions integrate concepts across all modules and require multi-step reasoning.

## Quiz: 20-capstone-portfolio


### Capstone portfolio $5M, target duration 4.5 years. Upgrade to Step 3: why underweight duration vs Bloomberg Agg (6yr) given bearish rate view?

- [✓] A: Lower duration means less price decline when yields rise

- [ ] B: Longer duration bonds always have lower yields

- [ ] C: Bloomberg Agg includes equities

- [ ] D: Duration has no impact on portfolio returns


**Answer:** A

Shorter duration = less sensitivity to rate increases. If yields rise 50bps, 4.5yr duration portfolio falls ~2.25% vs 3% for 6yr duration.


### Tax-equivalent yield on muni yielding 2.7% given 48.4% tax rate:

- [ ] A: 2.70%

- [ ] B: 3.98%

- [✓] C: 5.23%

- [ ] D: 6.35%


**Answer:** C

TEY = 2.7% / (1 - 0.484) = 2.7% / 0.516 = 5.23%. Munis highly valuable for this client.


### Portfolio generates $210K pre-tax income. Client needs $400K total. How to close gap?

- [ ] A: Increase bond portfolio to $10M

- [✓] B: Supplement with equity dividends and real estate cash flow

- [ ] C: Sell equities and buy more bonds

- [ ] D: Use margin loan to pay remainder


**Answer:** B

Bond portfolio covers ~$255K incl. tax benefit. Remaining income from existing equity dividends ($5M, ~1.5-2% = $75-100K) and real estate ($3M, ~3-5% = $90-150K) closes gap.


### Client needs $1M liquidity for real estate in 2-3 years. Best asset to allocate for this?

- [ ] A: 10-year corporate bonds

- [✓] B: 1-5yr Treasury ladder + cash equivalents (20% of portfolio)

- [ ] C: High-yield bonds with high coupon

- [ ] D: Long-duration muni bonds


**Answer:** B

Short Treasuries and cash provide predictable liquidity without forced sale losses. Total: $750K Treasuries + $250K cash = $1M.


### Maximum issuer concentration recommended in this portfolio:

- [ ] A: 10% per issuer

- [ ] B: 5% per issuer

- [✓] C: 3% per issuer

- [ ] D: 1% per issuer


**Answer:** C

Max 3% per issuer limits single-name default risk across the $5M portfolio.


### If yields rise 75bps as predicted, approximate portfolio price change (duration 4.5yr, convexity 0.4):

- [✓] A: -3.375% + convexity adjustment of +0.1125% = -3.26%

- [ ] B: -7.5% + convexity adjustment of +0.4% = -7.1%

- [ ] C: -4.5% only

- [ ] D: +3.375% + convexity adjustment


**Answer:** A

Duration effect = -4.5 × 0.75 = -3.375%. Convexity = 0.5 × 0.4 × (0.0075)^2 = +0.1125%. Net = -3.26%. Note convexity formula: 0.5 × C × (Δy)^2.


### Primary reason to avoid long-dated corporate bonds in this portfolio:

- [ ] A: Too much yield

- [✓] B: Most price sensitivity to rate increases + lower liquidity

- [ ] C: Tax treatment different for long bonds

- [ ] D: ESG restrictions prohibit it


**Answer:** B

Bearish rate view + long duration = maximum price decline. Also long corporate bonds less liquid than short/intermediate.


### Agency MBS limited to 10% of portfolio. Which risk does this primarily control?

- [ ] A: Credit risk (agency MBS are risk-free)

- [✓] B: Prepayment risk / negative convexity in falling rate environment

- [ ] C: Liquidity risk

- [ ] D: Currency risk


**Answer:** B

Agency MBS have negative convexity from prepayment risk. Limiting to 10% controls convexity exposure that could distort portfolio duration.


### Client's TIPS allocation provides inflation hedge. Risk of placing TIPS in taxable account (vs IRA)?

- [ ] A: TIPS have no special tax treatment

- [ ] B: TIPS generate phantom income — annual inflation adjustment taxed as income

- [ ] C: TIPS interest is exempt from state tax but not federal

- [✓] D: Both B and C apply


**Answer:** D

TIPS generate phantom income (inflation adjustment taxed yearly even though not received as cash). Interest exempt from state/local but taxable federally. For high-tax client, this creates cash-flow mismatch.


### Which rebalancing trigger is MOST important for maintaining portfolio risk profile?

- [ ] A: Rebalancing to yield targets monthly

- [✓] B: Duration rebalancing semi-annually (duration drifts as time passes and rates change)

- [ ] C: Rebalancing by bond rating quarterly

- [ ] D: Rebalancing based on tax-loss harvesting opportunities


**Answer:** B

Duration drifts naturally as bonds age and rates move, changing portfolio risk profile. Semi-annual duration rebalancing keeps risk consistent with IPS.
