# fgo-calc

Damage, Refund and Stargen calculator for player and enemy characters from Fate/Grand Order

## Example

#### Calc an example string

```typescript
import { ApiConnector, Language, Region, Servant, Enemy } from "@atlasacademy/api-connector";
import { calcSvt } from "fgo-calc";

const cacheDuration = 20 * 1000;
const apiConnector = new ApiConnector({
    host: "https://api.atlasacademy.io",
    region: Region.JP,
    language: Language.ENGLISH,
});

// For testing Leonardo da Vinci (Rider) on XMas 5 Lottery node:
const commandString = `c666 l100 ng10 n30 m20 ng45 a40 sg50 a30 fd500 lancer sky
 [m5 hp24945, m5 hp33371, m5 hp24526 fr30 fr40]
 [m20 n10 hp92001, m20 n10 hp34015, m20 n10 fr10 fr10 fr40 hp27176]
 [hp31308, hp31869, hp151215 fr40]`;

function getSvt(id: number): Promise<Servant.Servant | Enemy.Enemy> {
    return apiConnector.servant(id, false, cacheDuration);
}

getSvt(403500).then((svt) => calcSvt(svt, commandString));
```

#### Get human-readable help messages

```typescript
import { cmdArgs } from "fgo-calc";

cmdArgs();
```

---

Data sourced from [Atlas Academy](https://atlasacademy.io).
