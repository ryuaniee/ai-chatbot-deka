<?php

namespace App\Console\Commands;

use Database\Seeders\DekaManualKnowledgeSeeder;
use Illuminate\Console\Command;

class SeedDekaManualKnowledge extends Command
{
    protected $signature = 'deka:knowledge:seed-manual';

    protected $description = 'Seed manually configured Deka knowledge such as contact and address.';

    public function handle(DekaManualKnowledgeSeeder $seeder): int
    {
        $seeder->run();

        $this->components->info('Manual Deka knowledge seeded.');

        return self::SUCCESS;
    }
}
