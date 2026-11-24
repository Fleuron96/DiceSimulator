import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { CryptoCurrency, RollMode, Strategy } from '../types/dice';
import { formatTargetDisplay, targetFromChance } from './diceMath';
import { formatConditionSummary } from './strategyEngine';

export interface StrategyExportContext {
  cryptoSymbol: CryptoCurrency;
  initialCapital: number;
  baseBet: number;
  winChance: number;
  multiplier: number;
  rollMode: RollMode;
}

function makeCell(
  text: string,
  options?: {
    bold?: boolean;
    fill?: string;
    color?: string;
    widthPct?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  }
): TableCell {
  return new TableCell({
    width: options?.widthPct
      ? { size: options.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    shading: options?.fill
      ? { type: ShadingType.SOLID, color: options.fill, fill: options.fill }
      : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: options?.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: options?.bold ?? false,
            color: options?.color ?? '1E293B',
            size: 20,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function slugifyFileName(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'strategie-dice';
}

export async function exportStrategyToDocx(
  strategy: Strategy,
  ctx: StrategyExportContext
): Promise<string> {
  const nowStr = new Date().toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const targetVal = targetFromChance(ctx.winChance, ctx.rollMode);

  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
  };

  const paramRows = [
    ['Cryptomonnaie de simulation', ctx.cryptoSymbol],
    ['Capital initial', `${ctx.initialCapital.toLocaleString('fr-FR')} ${ctx.cryptoSymbol}`],
    ['Mise de base', `${ctx.baseBet.toFixed(8)} ${ctx.cryptoSymbol}`],
    ['Chance de gagner (P)', `${ctx.winChance.toFixed(4)} %`],
    ['Multiplicateur (M = 99 / P)', `${ctx.multiplier.toFixed(4)}×`],
    [
      'Mode & cible de lancer',
      `${ctx.rollMode === 'over' ? 'Lancer au Dessus de' : 'Lancer en Dessous de'} ${formatTargetDisplay(targetVal)}`,
    ],
    ['Avantage maison (House Edge)', '1 % (RTP théorique 99 %)'],
  ];

  const paramTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          makeCell('Paramètre', {
            bold: true,
            fill: '0F212E',
            color: 'FFFFFF',
            widthPct: 45,
          }),
          makeCell('Valeur configurée', {
            bold: true,
            fill: '0F212E',
            color: 'FFFFFF',
            widthPct: 55,
          }),
        ],
      }),
      ...paramRows.map(
        ([k, v], i) =>
          new TableRow({
            children: [
              makeCell(k, {
                bold: true,
                fill: i % 2 === 0 ? 'F8FAFC' : 'FFFFFF',
                widthPct: 45,
              }),
              makeCell(v, {
                fill: i % 2 === 0 ? 'F8FAFC' : 'FFFFFF',
                widthPct: 55,
              }),
            ],
          })
      ),
    ],
  });

  const conditionRows = strategy.conditions.map((cond, idx) => {
    const summary = formatConditionSummary(cond);
    const parts = summary.split(' → Alors ');
    const siPart = parts[0] || summary;
    const alorsPart = parts[1] ? `Alors ${parts[1]}` : '';
    return new TableRow({
      children: [
        makeCell(`#${idx + 1}`, {
          bold: true,
          fill: idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF',
          widthPct: 10,
          align: AlignmentType.CENTER,
        }),
        makeCell(siPart, {
          fill: idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF',
          widthPct: 45,
        }),
        makeCell(alorsPart, {
          fill: idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF',
          widthPct: 45,
        }),
      ],
    });
  });

  const conditionsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          makeCell('N°', {
            bold: true,
            fill: '1475E1',
            color: 'FFFFFF',
            widthPct: 10,
            align: AlignmentType.CENTER,
          }),
          makeCell('Condition (Bloc SI)', {
            bold: true,
            fill: '1475E1',
            color: 'FFFFFF',
            widthPct: 45,
          }),
          makeCell('Action exécutée (Bloc ALORS)', {
            bold: true,
            fill: '1475E1',
            color: 'FFFFFF',
            widthPct: 45,
          }),
        ],
      }),
      ...conditionRows,
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `Stratégie Stake Dice : ${strategy.name}`,
                bold: true,
                color: '0F212E',
                size: 36,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: `Exportée le ${nowStr} · ${
                  strategy.isPreset
                    ? 'Stratégie prédéfinie'
                    : 'Stratégie personnalisée'
                } · House Edge 1 % (RTP 99 %)`,
                color: '64748B',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          ...(strategy.description
            ? [
                new Paragraph({
                  spacing: { after: 220 },
                  children: [
                    new TextRun({
                      text: strategy.description,
                      italics: true,
                      color: '334155',
                      size: 22,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 120, after: 120 },
            children: [
              new TextRun({
                text: '1. Paramètres de simulation associés',
                bold: true,
                color: '1475E1',
                size: 26,
                font: 'Calibri',
              }),
            ],
          }),
          paramTable,
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 280, after: 120 },
            children: [
              new TextRun({
                text: `2. Règles conditionnelles Si / Alors (${strategy.conditions.length})`,
                bold: true,
                color: '1475E1',
                size: 26,
                font: 'Calibri',
              }),
            ],
          }),
          conditionsTable,
          new Paragraph({
            spacing: { before: 260 },
            children: [
              new TextRun({
                text: 'Note mathématique : Sur un jeu Dice à House Edge de 1 % (RTP 99 %), l’espérance mathématique théorique de chaque pari est de -1 % de la mise. Ce document est fourni à titre de simulation et d’analyse de stratégie virtuelle.',
                color: '64748B',
                size: 18,
                italics: true,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${slugifyFileName(strategy.name)}.docx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}
