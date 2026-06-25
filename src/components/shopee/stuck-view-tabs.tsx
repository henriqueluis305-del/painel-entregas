"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StuckRangeTable } from "@/components/shopee/stuck-range-table"
import { StuckTable } from "@/components/shopee/stuck-table"
import type { StuckRow } from "@/lib/shopee/stuck"

export function StuckViewTabs({ rows }: { rows: StuckRow[] }) {
  return (
    <Tabs defaultValue="por-base">
      <TabsList>
        <TabsTrigger value="por-base">Por Base</TabsTrigger>
        <TabsTrigger value="detalhe">Detalhe</TabsTrigger>
      </TabsList>
      <TabsContent value="por-base">
        <StuckRangeTable rows={rows} />
      </TabsContent>
      <TabsContent value="detalhe">
        <StuckTable rows={rows} />
      </TabsContent>
    </Tabs>
  )
}
