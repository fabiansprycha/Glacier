# Glacier: opuszczone biura (prototyp)

Top-down 2D, pixel art, proceduralnie generowane pomieszczenia. Działa w przeglądarce.

## Świat

AI przejęła władzę nad światem. Soft o nazwie **Glacier** niszczy ludzi i poluje na inne softy, które sprzymierzyły się z ludźmi. Gracz przechodzi przez opuszczone biura IT: open space'y, sale konferencyjne, archiwa, pokoje socjalne i zamrożone przez Glaciera serwerownie. Każde piętro biurowca to jeden poziom, a winda w serwerowni prowadzi wyżej.

## Uruchomienie

```bash
npm install
npm run dev          # serwer deweloperski z hot reloadem
npm test             # testy generatora (vitest)
npm run build        # wersja produkcyjna do dist/
npm run build:single # jeden plik dist-single/index.html (łatwo wysłać / wrzucić gdziekolwiek)
```

Sterowanie: WSAD (albo strzałki) to ruch, J to cios identyfikatorem na smyczy, K to rzut długopisem, spacja przeszukuje biurka, szafki i komputery, I (albo Tab) otwiera ekwipunek, R zaczyna nową grę. Wszystkie teksty w grze są po angielsku. Parametry adresu: `?seed=42` odtwarza układ, `?level=3` startuje od wybranego poziomu.

## Stack

- **TypeScript**: przy grze, która urośnie (statystyki, przedmioty, bossowie), typy oszczędzają mnóstwo błędów.
- **Phaser 4**: dojrzały silnik 2D do przeglądarki, ma kamerę, tilemapy, fizykę arcade, animacje, input, dźwięk.
- **Vite**: szybki dev server i build. **Vitest**: testy logiki bez przeglądarki.

## Architektura

```
src/
  core/      konfiguracja, seedowany RNG, sterowanie, typowane eventy między scenami
  world/     czysta logika świata, bez Phasera: generator lochu, układy pokoi, kafelki
  gfx/       placeholderowa grafika rysowana kodem (paleta Sweetie 16)
  entities/  gracz, drony, bossowie (drukarka, ochroniarz, matka roju, Glacier)
  systems/   walka, przeszukiwanie mebli, pułapki, kamery
  scenes/    Boot (tekstury) → Game (rozgrywka) + UI (HUD, minimapa) + Captcha (minigra) i Shop (automat) jako nakładki
tests/       testy generatora na setkach seedów
```

Zasady, które mają ułatwić rozbudowę:

1. **Generator jest czystą funkcją seeda** (`world/dungeon.ts`). Ten sam seed daje ten sam loch, więc da się go testować, debugować i udostępniać.
2. **Loch to drzewo pokoi na siatce** (jak w The Binding of Isaac). Najdalszy ślepy zaułek to pokój bossa, inny ślepy zaułek to skarbiec. Kolejne typy pokoi (sklep, sekret, wyzwanie) dodaje się w tym samym miejscu.
3. **Układy pokoi to wzorce + walidacja** (`world/roomLayout.ts`). Nowy wzorzec przeszkód wystarczy dopisać do listy; flood fill pilnuje, żeby żaden pokój nie miał odciętych drzwi.
4. **Sceny rozmawiają przez eventy** (`core/events.ts`), więc HUD, dźwięk czy osiągnięcia mogą nasłuchiwać bez grzebania w rozgrywce.
5. **Grafika jest podmienialna**: sprite'y mają nazwane klatki (`down-0`, `side-2`...). Gdy powstanie prawdziwy spritesheet, zmienia się tylko `gfx/`.

## Co jest w prototypie

- **4 poziomy** (`core/levels.ts`): Open space → Dział IT → Centrum danych → Rdzeń Glaciera. Każdy ma swoją liczbę pokoi, dronów, pułapek i trudność minigry. Kolejny poziom dodaje się jednym wpisem w tablicy `LEVELS`.
- **Bossowie**: Drukarka sieciowa (wachlarze i pierścienie kartek), Ochroniarz-bot (sygnalizuje szarżę i taranuje do ściany), Matka roju (trzyma dystans, wypuszcza drony), a na końcu **Glacier** (lodowe odłamki, w ostatniej 1/3 HP wzywa drony). Pokonanie Glaciera kończy grę zwycięstwem.
- **Walka**: identyfikator na smyczy (zamach łukiem, odrzut) i rzut długopisem (1 długopis na rzut). Drony i pociski latają nad meblami.
- **Drony** w zwykłych pokojach. Wejście do pokoju z dronami zamyka drzwi roletami, dopóki ich nie pokonasz.
- **Pułapki**: płyty z zerwanym kablem. Cykl: spokój, iskry (ostrzeżenie), prąd (obrażenia).
- **Kamery** w części pokoi bez dronów: obracają się i pokazują żółty stożek widzenia. Wejście w stożek włącza alarm, drzwi się zamykają i wlatuje dron (na wyższych poziomach więcej). Po alarmie kamera gaśnie.
- **Przeszukiwanie** (spacja) biurek (głównie długopisy), szafek (apteczki, pieniądze) i komputerów (pieniądze). Tylko gdy w pokoju nie ma dronów.
- **Komputery Glaciera** wyglądają jak zwykłe, więc nie wiadomo, który to pułapka. Przeszukanie takiego komputera otwiera minigrę „Udowodnij, że jesteś botem”. Trzeba wpisać sekwencję WSAD, zanim skończy się czas. Sukces daje bogaty łup, błąd albo koniec czasu włącza alarm: przez drzwi wlatują dodatkowe drony.
- **Przeszkody do rozwalenia**: kartony (3 ciosy), krzesła i suche rośliny (2), kwiatki (1). Rozwala się je identyfikatorem albo długopisami; czasem wypadnie z nich złotówka albo długopis. Bywa barykada przed drzwiami.
- **Zbuntowane drukarki**: zwykli wrogowie obok dronów (30–40% wrogów w pokojach). Stoją w miejscu i co 2 sekundy strzelają kartką papieru w gracza.
- **Balans bossów**: bossowie mają 2,5 raza więcej HP (45 / 60 / 70, Glacier 110) i liczą najwyżej jeden długopis na 0,22 s, więc wachlarz z długopisu 4-kolorowego nie topi ich w sekundę.
- **Sekretny parking podziemny** (poziom 1): za pękniętą ścianą w jednym z pokoi. Rozwal ją identyfikatorem albo długopisami, wejdź, przetrwaj 3 fale wrogów, nagroda: 10 PLN i przedmiot.
- **Ekwipunek** (I / Tab): statystyki i lista przedmiotów z opisami; na HUD jest tylko licznik, żeby nic nie zasłaniało gry.
- **Automaty** (2 na poziom): w każdym jedna przekąska (batonik +2 HP albo paczka długopisów) i dwa przedmioty, których jeszcze nie masz. Płacisz złotówkami (PLN): 1 zł za drona, 6 zł za bossa, reszta z przeszukiwania.
- **Przedmioty z efektami** (`core/items.ts`): długopis 4-kolorowy (3 długopisy naraz), długopis żelowy (przebija wrogów), zszywacz (szybsze rzuty), kieszonka na długopisy, smycz bungee (dłuższy cios), identyfikator VIP (cios niszczy pociski), opaska antystatyczna (odporność na pułapki), bluza z kapturem (kamery widzą z bliska), firmowy kubek (+1 HP za czysty pokój), słuchawki z ANC (więcej czasu w minigrze), espresso (szybszy ruch) oraz statystyczne: stalowa smycz, pióro wieczne, termos. Każdy przedmiot można mieć raz. Źródła: automaty, łupy, komputery Glaciera, terminal ARGUS i bossowie.
- **Terminal ARGUS** (sojuszniczy soft) w pokoju socjalnym: pełna naprawa, długopisy do 10, jeden przedmiot.
- HP, długopisy, pieniądze i ulepszenia przechodzą między poziomami. Śmierć zaczyna nową grę.

## Następne kroki (propozycja kolejności)

1. Więcej typów przeciwników (np. strzelające kamery) i drop z pokonanych dronów. Więcej rodzajów pułapek.
2. Aktywne przedmioty z ładowaniem (np. zagłuszacz dronów), synergie między przedmiotami.
3. Kolejne fazy Glaciera (np. zamrażanie podłogi), inne minigry hakerskie.
4. Progresja: poziom postaci / drzewko ulepszeń między runami, zapis w localStorage.
5. Prawdziwa grafika i dźwięk.
