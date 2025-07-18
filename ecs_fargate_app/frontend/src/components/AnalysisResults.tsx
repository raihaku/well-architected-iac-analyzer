import React, { useState } from 'react';
import {
  Table,
  Box,
  StatusIndicator,
  Link,
  PropertyFilter,
  Pagination,
  CollectionPreferences,
  Button,
  Header,
  Container,
  KeyValuePairs,
  SpaceBetween,
} from '@cloudscape-design/components';
import { HelpButton } from './utils/HelpButton';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { AnalysisResult, BestPractice, IaCTemplateType } from '../types';
import { DetailsModal } from './DetailsModal';
import { analyzerApi } from '../services/api';
import { useChat } from '../components/chat/ChatContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getTableFilteringProperties,
  getPaginationLabels,
  getMatchesCountTextI18n,
  getPropertyFilterI18nStrings,
} from './utils/table-configs/analysis-table-config';

interface AnalysisResultsProps {
  results: AnalysisResult[];
  isAnalyzing: boolean;
  onDownloadRecommendations: () => void;
  onGenerateIacDocument: () => void;
  isDownloading: boolean;
  isImplementing: boolean;
  isLoadingDetails: boolean;
  setIsLoadingDetails: (loading: boolean) => void;
  uploadedFileType: string;
  selectedIaCType: IaCTemplateType;
  setError: (error: string | null) => void;
  fileId: string;
  fileName: string;
  lensAliasArn?: string;
  lensName: string;
  outputLanguage: string;
}

interface EnhancedBestPractice extends BestPractice {
  pillar: string;
  question: string;
  questionId: string;
}

interface PreferencesType {
  pageSize: number;
  visibleContent: readonly string[];
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ results, isAnalyzing, onDownloadRecommendations, onGenerateIacDocument, isDownloading, isImplementing, isLoadingDetails, setIsLoadingDetails, uploadedFileType, selectedIaCType, setError, fileId, fileName, lensAliasArn, lensName, outputLanguage }) => {
  const [preferences, setPreferences] = useState<PreferencesType>({
    pageSize: 10,
    visibleContent: ['pillar', 'question', 'name', 'status', 'reason', 'recommendations'],
  });
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [detailsContent, setDetailsContent] = useState('');
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const { openChatWithSupportPrompt } = useChat();
  const { strings, language } = useLanguage();

  const handleGenerateIacClick = () => {
    onGenerateIacDocument();
  };

  const handleGetMoreDetails = async () => {
    try {
      setIsLoadingDetails(true);
      setDetailsError(null);

      const result = await analyzerApi.getMoreDetails(
        selectedItems,
        fileId,
        selectedIaCType,
        lensAliasArn,
        lensName,
        outputLanguage
      );

      if (result.error) {
        setDetailsError(result.error);
      }

      if (result.content) {
        setDetailsContent(result.content);
        setDetailsModalVisible(true);
      } else {
        setError('No content received from analysis. Please try again.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to get detailed analysis');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getBestPracticeCounts = (practices: EnhancedBestPractice[]) => {
    const counts = practices.reduce(
      (acc, practice) => ({
        applied: acc.applied + (practice.relevant && practice.applied ? 1 : 0),
        notApplied: acc.notApplied + (practice.relevant && !practice.applied ? 1 : 0),
        notRelevant: acc.notRelevant + (!practice.relevant ? 1 : 0),
      }),
      { applied: 0, notApplied: 0, notRelevant: 0 }
    );
  
    return {
      ...counts,
      totalReviewed: counts.applied + counts.notApplied + counts.notRelevant
    };
  };

  // Transform the nested structure into a flat array
  const flattenedBestPractices: EnhancedBestPractice[] = results.flatMap(result =>
    result.bestPractices.map(bp => ({
      ...bp,
      pillar: result.pillar,
      question: result.question,
      questionId: result.questionId,
    }))
  );

  const { applied, notApplied, notRelevant, totalReviewed } = getBestPracticeCounts(flattenedBestPractices);

  // Get localized configurations
  const tableFilteringProperties = getTableFilteringProperties(language);
  const paginationLabels = getPaginationLabels(language);
  const propertyFilterI18nStrings = getPropertyFilterI18nStrings(language);

  const { items, actions, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } = useCollection(
    flattenedBestPractices,
    {
      propertyFiltering: {
        filteringProperties: tableFilteringProperties,
        empty: (
          <Box textAlign="center" color="inherit">
            <b>{strings.analysisResults.noBestPracticesFound}</b>
          </Box>
        ),
        noMatch: (
          <Box textAlign="center" color="inherit">
            <b>{strings.analysisResults.noMatches}</b>
            <Box color="inherit" padding={{ top: 's' }}>
              <Button onClick={() => actions.setPropertyFiltering({ tokens: [], operation: 'and' })}>
                {strings.analysisResults.clearFilter}
              </Button>
            </Box>
          </Box>
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: { sortingField: 'pillar' } } },
    }
  );

  const handleCancelGeneration = async () => {
    try {
      await analyzerApi.cancelIaCGeneration();
    } catch (error) {
      console.error('Failed to cancel IaC generation:', error);
    }
  };

  // Function to handle chat icon click in recommendations cell
  const handleAiChatClick = (item: EnhancedBestPractice) => {
    const prompt = `Can you provide more detailed recommendations and instructions for the best practice '${item.name}' of the '${item.pillar}' pillar?`;
    
    // Open the chat with support prompt
    openChatWithSupportPrompt(prompt);
  };

  // Extract alias from lensAliasArn
  const lensAlias = lensAliasArn?.split('/')?.pop() || 'wellarchitected';

  return (
    <div>
      <Container
        variant="stacked"
      >
        <KeyValuePairs
          columns={4}
          items={[
            {
              label: strings.analysisResults.bestPracticesReviewed,
              value: isAnalyzing ?
                <StatusIndicator type="loading">{strings.common.loading}</StatusIndicator> :
                <StatusIndicator type="info">{totalReviewed}</StatusIndicator>
            },
            {
              label: strings.analysisResults.bestPracticesApplied,
              value: isAnalyzing ?
                <StatusIndicator type="loading">{strings.common.loading}</StatusIndicator> :
                <StatusIndicator>{applied}</StatusIndicator>
            },
            {
              label: strings.analysisResults.bestPracticesNotApplied,
              value: isAnalyzing ?
                <StatusIndicator type="loading">{strings.common.loading}</StatusIndicator> :
                <StatusIndicator type="error">{notApplied}</StatusIndicator>
            },
            {
              label: strings.analysisResults.bestPracticesNotRelevant,
              value: isAnalyzing ?
                <StatusIndicator type="loading">{strings.common.loading}</StatusIndicator> :
                <StatusIndicator type="stopped">{notRelevant}</StatusIndicator>
            }
          ]}
        />
      </Container>
      <Table
        {...collectionProps}
        variant="stacked"
        header={
          <Header
            variant="h3"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  onClick={handleGetMoreDetails}
                  loading={isLoadingDetails}
                  disabled={selectedItems.length === 0 || isLoadingDetails}
                  iconName="gen-ai"
                >
                  {strings.analysisResults.getMoreDetails}
                </Button>
                <Button
                  onClick={handleGenerateIacClick}
                  loading={isImplementing}
                  disabled={isDownloading || isImplementing || !uploadedFileType.startsWith('image/')}
                  iconName="gen-ai"
                >
                  {strings.analysisResults.generateIacDocument}
                </Button>
                {isImplementing && (
                  <Button
                    onClick={handleCancelGeneration}
                    iconName="close"
                  >
                    {strings.analysisResults.cancelIacGeneration}
                  </Button>
                )}
                <Button
                  onClick={onDownloadRecommendations}
                  loading={isDownloading}
                  disabled={isDownloading || isImplementing}
                  iconName="download"
                >
                  {strings.analysisResults.downloadAnalysis}
                </Button>
              </SpaceBetween>
            }
            info={<HelpButton contentId="analysisResults" />}
          >
            {strings.analysisResults.title}
          </Header>
        }
        columnDefinitions={[
          {
            id: 'pillar',
            header: strings.analysisResults.pillar,
            cell: item => item.pillar,
            sortingField: 'pillar',
          },
          {
            id: 'question',
            header: strings.analysisResults.question,
            cell: item => item.question,
            sortingField: 'question',
          },
          {
            id: 'name',
            header: strings.analysisResults.bestPractice,
            cell: item => (
              <Link external href={
                lensAlias === 'wellarchitected' 
                  ? `https://docs.aws.amazon.com/wellarchitected/latest/framework/${item.id}.html`
                  : `https://docs.aws.amazon.com/search/doc-search.html?searchPath=documentation-guide&searchQuery=${encodeURIComponent(`"${lensName}"+"${item.pillar}"`)}`
              }>
                {item.name}
              </Link>
            ),
            sortingField: 'name',
            minWidth: 200,
          },
          {
            id: 'status',
            header: strings.analysisResults.status,
            cell: item => {
              if (!item.relevant) {
                return <StatusIndicator type="stopped">{strings.analysisResults.notRelevant}</StatusIndicator>;
              }
              return (
                <StatusIndicator type={item.applied ? 'success' : 'error'}>
                  {item.applied ? strings.analysisResults.applied : strings.analysisResults.notApplied}
                </StatusIndicator>
              );
            },
            sortingField: 'applied',
            minWidth: 145,
          },
          {
            id: 'reason',
            header: strings.analysisResults.reason,
            cell: item => {
              if (!item.relevant) {
                return 'N/A';
              }
              return item.applied ? item.reasonApplied : item.reasonNotApplied;
            },
            minWidth: 200,
          },
          {
            id: 'recommendations',
            header: strings.analysisResults.recommendations,
            cell: item => {
              if (!item.relevant) {
                return 'N/A';
              }
              // If there are recommendations, show them with the AI chat button
              if (!item.applied && item.recommendations) {
                return (
                  <SpaceBetween direction="horizontal" size="xs">
                    {item.recommendations}
                    <Button
                      iconName="gen-ai"
                      variant="inline-icon"
                      onClick={() => handleAiChatClick(item)}
                      ariaLabel={strings.analysisResults.askAiForMoreRecommendations}
                    />
                  </SpaceBetween>
                );
              }
              return !item.applied && item.recommendations || 'N/A';
            },
            minWidth: 500,
          },
        ]}
        items={items}
        loadingText={`${strings.common.analyze}...`}
        loading={isAnalyzing}
        columnDisplay={preferences.visibleContent.map(id => ({ id, visible: true }))}
        wrapLines
        stickyHeader
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) =>
          setSelectedItems(detail.selectedItems)
        }
        ariaLabels={{
          allItemsSelectionLabel: ({ selectedItems }) =>
            `${selectedItems.length} ${selectedItems.length === 1 ? strings.common.item : strings.common.items} ${strings.common.selected}`,
          itemSelectionLabel: ({ selectedItems }, item) => {
            const isItemSelected = selectedItems.filter(i => i.id === item.id).length > 0;
            return `"${item.name}" is ${isItemSelected ? "" : strings.common.notSelected}`;
          }
        }}
        trackBy='name'
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            i18nStrings={propertyFilterI18nStrings}
            countText={getMatchesCountTextI18n(filteredItemsCount || 0, language)}
            expandToViewport
          />
        }
        pagination={<Pagination {...paginationProps} ariaLabels={paginationLabels} />}
        preferences={
          <CollectionPreferences
            title={strings.analysisResults.preferences}
            confirmLabel={strings.common.confirm}
            cancelLabel={strings.common.cancel}
            preferences={preferences}
            onConfirm={({ detail }) => setPreferences({
              pageSize: detail.pageSize || 10,
              visibleContent: detail.visibleContent || [],
            })}
            pageSizePreference={{
              title: strings.analysisResults.pageSize,
              options: [
                { value: 10, label: `10 ${strings.analysisResults.bestPractice.toLowerCase()}` },
                { value: 25, label: `25 ${strings.analysisResults.bestPractice.toLowerCase()}` },
                { value: 50, label: `50 ${strings.analysisResults.bestPractice.toLowerCase()}` },
                { value: 100, label: `100 ${strings.analysisResults.bestPractice.toLowerCase()}` },
              ],
            }}
          />
        }
      />
      <DetailsModal
        visible={detailsModalVisible}
        onDismiss={() => setDetailsModalVisible(false)}
        content={detailsContent}
        error={detailsError || undefined}
        originalFileName={fileName}
        lensAlias={lensAlias}
      />
    </div>
  );
};
