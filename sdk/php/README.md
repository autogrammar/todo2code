# todo2code PHP SDK

Klient A2A v1.0 na samej bibliotece standardowej (`ext-json` + streamy).

```php
$client = new Todo2Code\Client('http://localhost:8787', getenv('T2C_A2A_TOKEN') ?: null);

$ast = $client->extractAst('examples/backend');
$graph = $client->link($ast['records']);
$report = $client->diagnose($graph);

$reality = $client->reality($graph, $report, ['gapsOnly' => true]);
echo $reality['markdown'];
```

```bash
php sdk/php/examples/basic.php
```

Przykład zawiera minimalny autoloader PSR-4, więc działa bez `composer install`.
Pełny opis akcji: [`../README.md`](../README.md).
