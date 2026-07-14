<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('passkeys');
    }

    public function down(): void
    {
        // Passkeys support has been removed from this project.
    }
};
