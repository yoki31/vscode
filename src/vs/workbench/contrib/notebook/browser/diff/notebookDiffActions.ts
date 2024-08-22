/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IBulkEditService, ResourceTextEdit } from 'vs/editor/browser/services/bulkEditService';
import { localize, localize2 } from 'vs/nls';
import { Action2, MenuId, registerAction2 } from 'vs/platform/actions/common/actions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ContextKeyExpr, ContextKeyExpression } from 'vs/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ActiveEditorContext } from 'vs/workbench/common/contextkeys';
import { DiffElementCellViewModelBase, SideBySideDiffElementViewModel } from 'vs/workbench/contrib/notebook/browser/diff/diffElementViewModel';
import { INotebookTextDiffEditor, NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE_KEY, NOTEBOOK_DIFF_CELL_INPUT, NOTEBOOK_DIFF_CELL_PROPERTY, NOTEBOOK_DIFF_CELL_PROPERTY_EXPANDED, NOTEBOOK_DIFF_CELLS_COLLAPSED, NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS, NOTEBOOK_DIFF_ITEM_DIFF_STATE, NOTEBOOK_DIFF_ITEM_KIND, NOTEBOOK_DIFF_UNCHANGED_CELLS_HIDDEN } from 'vs/workbench/contrib/notebook/browser/diff/notebookDiffEditorBrowser';
import { NotebookTextDiffEditor } from 'vs/workbench/contrib/notebook/browser/diff/notebookDiffEditor';
import { NotebookDiffEditorInput } from 'vs/workbench/contrib/notebook/common/notebookDiffEditorInput';
import { nextChangeIcon, openAsTextIcon, previousChangeIcon, renderOutputIcon, revertIcon, toggleWhitespace } from 'vs/workbench/contrib/notebook/browser/notebookIcons';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { ICommandActionTitle } from 'vs/platform/action/common/action';
import { DEFAULT_EDITOR_ASSOCIATION } from 'vs/workbench/common/editor';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { CellEditType, NOTEBOOK_DIFF_EDITOR_ID } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/textResourceConfiguration';
import { NotebookMultiTextDiffEditor } from 'vs/workbench/contrib/notebook/browser/diff/notebookMultiDiffEditor';
import { Codicon } from 'vs/base/common/codicons';
import type { URI } from 'vs/base/common/uri';
import { TextEditorSelectionRevealType, type ITextEditorOptions } from 'vs/platform/editor/common/editor';

// ActiveEditorContext.isEqualTo(SearchEditorConstants.SearchEditorID)

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'notebook.diff.switchToText',
			icon: openAsTextIcon,
			title: localize2('notebook.diff.switchToText', 'Open Text Diff Editor'),
			precondition: ContextKeyExpr.or(ActiveEditorContext.isEqualTo(NotebookTextDiffEditor.ID), ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID)),
			menu: [{
				id: MenuId.EditorTitle,
				group: 'navigation',
				when: ContextKeyExpr.or(ActiveEditorContext.isEqualTo(NotebookTextDiffEditor.ID), ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID)),
			}]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);

		const activeEditor = editorService.activeEditorPane;
		if (!activeEditor) {
			return;
		}
		if (activeEditor instanceof NotebookTextDiffEditor || activeEditor instanceof NotebookMultiTextDiffEditor) {
			const diffEditorInput = activeEditor.input as NotebookDiffEditorInput;

			await editorService.openEditor(
				{
					original: { resource: diffEditorInput.original.resource },
					modified: { resource: diffEditorInput.resource },
					label: diffEditorInput.getName(),
					options: {
						preserveFocus: false,
						override: DEFAULT_EDITOR_ASSOCIATION.id
					}
				});
		}
	}
});


registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'notebook.diffEditor.showUnchangedCells',
			title: localize2('showUnchangedCells', 'Show Unchanged Cells'),
			icon: Codicon.unfold,
			precondition: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID), ContextKeyExpr.has(NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS.key)),
			menu: {
				when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID), ContextKeyExpr.has(NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS.key), ContextKeyExpr.equals(NOTEBOOK_DIFF_UNCHANGED_CELLS_HIDDEN.key, true)),
				id: MenuId.EditorTitle,
				order: 22,
				group: 'navigation',
			},
		});
	}

	run(accessor: ServicesAccessor, ...args: unknown[]): void {
		const activeEditor = accessor.get(IEditorService).activeEditorPane;
		if (!activeEditor) {
			return;
		}
		if (activeEditor instanceof NotebookMultiTextDiffEditor) {
			activeEditor.showUnchanged();
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'notebook.diffEditor.hideUnchangedCells',
			title: localize2('hideUnchangedCells', 'Hide Unchanged Cells'),
			icon: Codicon.fold,
			precondition: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID), ContextKeyExpr.has(NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS.key)),
			menu: {
				when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID), ContextKeyExpr.has(NOTEBOOK_DIFF_HAS_UNCHANGED_CELLS.key), ContextKeyExpr.equals(NOTEBOOK_DIFF_UNCHANGED_CELLS_HIDDEN.key, false)),
				id: MenuId.EditorTitle,
				order: 22,
				group: 'navigation',
			},
		});
	}

	run(accessor: ServicesAccessor, ...args: unknown[]): void {
		const activeEditor = accessor.get(IEditorService).activeEditorPane;
		if (!activeEditor) {
			return;
		}
		if (activeEditor instanceof NotebookMultiTextDiffEditor) {
			activeEditor.hideUnchanged();
		}
	}
});

registerAction2(class GoToFileAction extends Action2 {
	constructor() {
		super({
			id: 'notebook.diffEditor.2.goToCell',
			title: localize2('goToCell', 'Go To Cell'),
			icon: Codicon.goToFile,
			menu: {
				when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID), ContextKeyExpr.equals(NOTEBOOK_DIFF_ITEM_KIND.key, 'Cell'), ContextKeyExpr.notEquals(NOTEBOOK_DIFF_ITEM_DIFF_STATE.key, 'delete')),
				id: MenuId.MultiDiffEditorFileToolbar,
				order: 0,
				group: 'navigation',
			},
		});
	}

	async run(accessor: ServicesAccessor, ...args: any[]): Promise<void> {
		const uri = args[0] as URI;
		const editorService = accessor.get(IEditorService);
		const activeEditorPane = editorService.activeEditorPane;
		if (!(activeEditorPane instanceof NotebookMultiTextDiffEditor)) {
			return;
		}

		await editorService.openEditor({
			resource: uri,
			options: {
				selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport,
			} satisfies ITextEditorOptions,
		});
	}
});

const revertInput = localize('notebook.diff.cell.revertInput', "Revert Input");

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'notebook.diffEditor.2.cell.revertInput',
			title: revertInput,
			icon: revertIcon,
			menu: {
				when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID), ContextKeyExpr.equals(NOTEBOOK_DIFF_ITEM_KIND.key, 'Cell'), ContextKeyExpr.equals(NOTEBOOK_DIFF_ITEM_DIFF_STATE.key, 'modified')),
				id: MenuId.MultiDiffEditorFileToolbar,
				order: 2,
				group: 'navigation',
			},
		});
	}

	async run(accessor: ServicesAccessor, ...args: any[]): Promise<void> {
		const uri = args[0] as URI;
		const editorService = accessor.get(IEditorService);
		const activeEditorPane = editorService.activeEditorPane;
		if (!(activeEditorPane instanceof NotebookMultiTextDiffEditor)) {
			return;
		}

		const item = activeEditorPane.getDiffElementViewModel(uri);
		if (item && item instanceof SideBySideDiffElementViewModel) {
			const modified = item.modified;
			const original = item.original;

			if (!original || !modified) {
				return;
			}

			const bulkEditService = accessor.get(IBulkEditService);
			await bulkEditService.apply([
				new ResourceTextEdit(modified.uri, { range: modified.textModel.getFullModelRange(), text: original.textModel.getValue() }),
			], { quotableLabel: 'Revert Notebook Cell Content Change' });
		}
	}
});

const revertOutputs = localize('notebook.diff.cell.revertOutputs', "Revert Outputs");

registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.diffEditor.2.cell.revertOutputs',
				title: revertOutputs,
				icon: revertIcon,
				f1: false,
				menu: {
					when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID), ContextKeyExpr.equals(NOTEBOOK_DIFF_ITEM_KIND.key, 'Output'), ContextKeyExpr.equals(NOTEBOOK_DIFF_ITEM_DIFF_STATE.key, 'modified')),
					id: MenuId.MultiDiffEditorFileToolbar,
					order: 2,
					group: 'navigation',
				},
			}
		);
	}
	async run(accessor: ServicesAccessor, ...args: any[]): Promise<void> {
		const uri = args[0] as URI;
		const editorService = accessor.get(IEditorService);
		const activeEditorPane = editorService.activeEditorPane;
		if (!(activeEditorPane instanceof NotebookMultiTextDiffEditor)) {
			return;
		}

		const item = activeEditorPane.getDiffElementViewModel(uri);
		if (item && item instanceof SideBySideDiffElementViewModel) {
			const original = item.original;

			const modifiedCellIndex = item.modifiedDocument.cells.findIndex(cell => cell.handle === item.modified.handle);
			if (modifiedCellIndex === -1) {
				return;
			}

			item.mainDocumentTextModel.applyEdits([{
				editType: CellEditType.Output, index: modifiedCellIndex, outputs: original.outputs
			}], true, undefined, () => undefined, undefined, true);
		}
	}
});

const revertMetadata = localize('notebook.diff.cell.revertMetadata', "Revert Metadata");

registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.diffEditor.2.cell.revertMetadata',
				title: revertMetadata,
				icon: revertIcon,
				f1: false,
				menu: {
					when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID), ContextKeyExpr.equals(NOTEBOOK_DIFF_ITEM_KIND.key, 'Metadata'), ContextKeyExpr.equals(NOTEBOOK_DIFF_ITEM_DIFF_STATE.key, 'modified')),
					id: MenuId.MultiDiffEditorFileToolbar,
					order: 2,
					group: 'navigation',
				},
			}
		);
	}
	async run(accessor: ServicesAccessor, ...args: any[]): Promise<void> {
		const uri = args[0] as URI;
		const editorService = accessor.get(IEditorService);
		const activeEditorPane = editorService.activeEditorPane;
		if (!(activeEditorPane instanceof NotebookMultiTextDiffEditor)) {
			return;
		}

		const item = activeEditorPane.getDiffElementViewModel(uri);
		if (item && item instanceof SideBySideDiffElementViewModel) {
			const original = item.original;

			const modifiedCellIndex = item.modifiedDocument.cells.findIndex(cell => cell.handle === item.modified.handle);
			if (modifiedCellIndex === -1) {
				return;
			}

			item.mainDocumentTextModel.applyEdits([{
				editType: CellEditType.Metadata, index: modifiedCellIndex, metadata: original.metadata
			}], true, undefined, () => undefined, undefined, true);
		}
	}
});


registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.diff.cell.revertMetadata',
				title: revertMetadata,
				icon: revertIcon,
				f1: false,
				menu: {
					id: MenuId.NotebookDiffCellMetadataTitle,
					when: NOTEBOOK_DIFF_CELL_PROPERTY
				},
				precondition: NOTEBOOK_DIFF_CELL_PROPERTY
			}
		);
	}
	run(accessor: ServicesAccessor, context?: { cell: DiffElementCellViewModelBase }) {
		if (!context) {
			return;
		}

		const original = context.cell.original;
		const modified = context.cell.modified;

		if (!original || !modified) {
			return;
		}

		modified.textModel.metadata = original.metadata;
	}
});

// registerAction2(class extends Action2 {
// 	constructor() {
// 		super(
// 			{
// 				id: 'notebook.diff.cell.switchOutputRenderingStyle',
// 				title: localize('notebook.diff.cell.switchOutputRenderingStyle', "Switch Outputs Rendering"),
// 				icon: renderOutputIcon,
// 				f1: false,
// 				menu: {
// 					id: MenuId.NotebookDiffCellOutputsTitle
// 				}
// 			}
// 		);
// 	}
// 	run(accessor: ServicesAccessor, context?: { cell: DiffElementViewModelBase }) {
// 		if (!context) {
// 			return;
// 		}

// 		context.cell.renderOutput = true;
// 	}
// });


registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.diff.cell.switchOutputRenderingStyleToText',
				title: localize('notebook.diff.cell.switchOutputRenderingStyleToText', "Switch Output Rendering"),
				icon: renderOutputIcon,
				f1: false,
				menu: {
					id: MenuId.NotebookDiffCellOutputsTitle,
					when: NOTEBOOK_DIFF_CELL_PROPERTY_EXPANDED
				}
			}
		);
	}
	run(accessor: ServicesAccessor, context?: { cell: DiffElementCellViewModelBase }) {
		if (!context) {
			return;
		}

		context.cell.renderOutput = !context.cell.renderOutput;
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.diff.cell.revertOutputs',
				title: localize('notebook.diff.cell.revertOutputs', "Revert Outputs"),
				icon: revertIcon,
				f1: false,
				menu: {
					id: MenuId.NotebookDiffCellOutputsTitle,
					when: NOTEBOOK_DIFF_CELL_PROPERTY
				},
				precondition: NOTEBOOK_DIFF_CELL_PROPERTY
			}
		);
	}
	run(accessor: ServicesAccessor, context?: { cell: DiffElementCellViewModelBase }) {
		if (!context) {
			return;
		}

		if (!(context.cell instanceof SideBySideDiffElementViewModel)) {
			return;
		}

		const original = context.cell.original;
		const modified = context.cell.modified;

		const modifiedCellIndex = context.cell.mainDocumentTextModel.cells.indexOf(modified.textModel);
		if (modifiedCellIndex === -1) {
			return;
		}

		context.cell.mainDocumentTextModel.applyEdits([{
			editType: CellEditType.Output, index: modifiedCellIndex, outputs: original.outputs
		}], true, undefined, () => undefined, undefined, true);
	}
});


registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.toggle.diff.cell.ignoreTrimWhitespace',
				title: localize('ignoreTrimWhitespace.label', "Show Leading/Trailing Whitespace Differences"),
				icon: toggleWhitespace,
				f1: false,
				menu: {
					id: MenuId.NotebookDiffCellInputTitle,
					when: NOTEBOOK_DIFF_CELL_INPUT,
					order: 1,
				},
				precondition: NOTEBOOK_DIFF_CELL_INPUT,
				toggled: ContextKeyExpr.equals(NOTEBOOK_DIFF_CELL_IGNORE_WHITESPACE_KEY, false),
			}
		);
	}
	run(accessor: ServicesAccessor, context?: { cell: DiffElementCellViewModelBase }) {
		const cell = context?.cell;
		if (!cell?.modified) {
			return;
		}
		const uri = cell.modified.uri;
		const configService = accessor.get(ITextResourceConfigurationService);
		const key = 'diffEditor.ignoreTrimWhitespace';
		const val = configService.getValue(uri, key);
		configService.updateValue(uri, key, !val);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.diff.cell.revertInput',
				title: revertInput,
				icon: revertIcon,
				f1: false,
				menu: {
					id: MenuId.NotebookDiffCellInputTitle,
					when: NOTEBOOK_DIFF_CELL_INPUT,
					order: 2
				},
				precondition: NOTEBOOK_DIFF_CELL_INPUT

			}
		);
	}
	run(accessor: ServicesAccessor, context?: { cell: DiffElementCellViewModelBase }) {
		if (!context) {
			return;
		}

		const original = context.cell.original;
		const modified = context.cell.modified;

		if (!original || !modified) {
			return;
		}

		const bulkEditService = accessor.get(IBulkEditService);
		return bulkEditService.apply([
			new ResourceTextEdit(modified.uri, { range: modified.textModel.getFullModelRange(), text: original.textModel.getValue() }),
		], { quotableLabel: 'Revert Notebook Cell Content Change' });
	}
});

class ToggleRenderAction extends Action2 {
	constructor(id: string, title: string | ICommandActionTitle, precondition: ContextKeyExpression | undefined, toggled: ContextKeyExpression | undefined, order: number, private readonly toggleOutputs?: boolean, private readonly toggleMetadata?: boolean) {
		super({
			id: id,
			title,
			precondition: precondition,
			menu: [{
				id: MenuId.EditorTitle,
				group: 'notebook',
				when: precondition,
				order: order,
			}],
			toggled: toggled
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);

		if (this.toggleOutputs !== undefined) {
			const oldValue = configurationService.getValue('notebook.diff.ignoreOutputs');
			configurationService.updateValue('notebook.diff.ignoreOutputs', !oldValue);
		}

		if (this.toggleMetadata !== undefined) {
			const oldValue = configurationService.getValue('notebook.diff.ignoreMetadata');
			configurationService.updateValue('notebook.diff.ignoreMetadata', !oldValue);
		}
	}
}

registerAction2(class extends ToggleRenderAction {
	constructor() {
		super('notebook.diff.showOutputs',
			localize2('notebook.diff.showOutputs', 'Show Outputs Differences'),
			ContextKeyExpr.or(ActiveEditorContext.isEqualTo(NotebookTextDiffEditor.ID), ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID)),
			ContextKeyExpr.notEquals('config.notebook.diff.ignoreOutputs', true),
			2,
			true,
			undefined
		);
	}
});

registerAction2(class extends ToggleRenderAction {
	constructor() {
		super('notebook.diff.showMetadata',
			localize2('notebook.diff.showMetadata', 'Show Metadata Differences'),
			ContextKeyExpr.or(ActiveEditorContext.isEqualTo(NotebookTextDiffEditor.ID), ActiveEditorContext.isEqualTo(NotebookMultiTextDiffEditor.ID)),
			ContextKeyExpr.notEquals('config.notebook.diff.ignoreMetadata', true),
			1,
			undefined,
			true
		);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.diff.action.previous',
				title: localize('notebook.diff.action.previous.title', "Show Previous Change"),
				icon: previousChangeIcon,
				f1: false,
				keybinding: {
					primary: KeyMod.Shift | KeyMod.Alt | KeyCode.F3,
					weight: KeybindingWeight.WorkbenchContrib,
					when: ActiveEditorContext.isEqualTo(NotebookTextDiffEditor.ID)
				},
				menu: {
					id: MenuId.EditorTitle,
					group: 'navigation',
					when: ActiveEditorContext.isEqualTo(NotebookTextDiffEditor.ID)
				}
			}
		);
	}
	run(accessor: ServicesAccessor) {
		const editorService: IEditorService = accessor.get(IEditorService);
		if (editorService.activeEditorPane?.getId() !== NOTEBOOK_DIFF_EDITOR_ID) {
			return;
		}

		const editor = editorService.activeEditorPane.getControl() as INotebookTextDiffEditor | undefined;
		editor?.previousChange();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super(
			{
				id: 'notebook.diff.action.next',
				title: localize('notebook.diff.action.next.title', "Show Next Change"),
				icon: nextChangeIcon,
				f1: false,
				keybinding: {
					primary: KeyMod.Alt | KeyCode.F3,
					weight: KeybindingWeight.WorkbenchContrib,
					when: ActiveEditorContext.isEqualTo(NotebookTextDiffEditor.ID)
				},
				menu: {
					id: MenuId.EditorTitle,
					group: 'navigation',
					when: ActiveEditorContext.isEqualTo(NotebookTextDiffEditor.ID)
				}
			}
		);
	}
	run(accessor: ServicesAccessor) {
		const editorService: IEditorService = accessor.get(IEditorService);
		if (editorService.activeEditorPane?.getId() !== NOTEBOOK_DIFF_EDITOR_ID) {
			return;
		}

		const editor = editorService.activeEditorPane.getControl() as INotebookTextDiffEditor | undefined;
		editor?.nextChange();
	}
});



Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'notebook',
	order: 100,
	type: 'object',
	'properties': {
		'notebook.diff.ignoreMetadata': {
			type: 'boolean',
			default: false,
			markdownDescription: localize('notebook.diff.ignoreMetadata', "Hide Metadata Differences")
		},
		'notebook.diff.ignoreOutputs': {
			type: 'boolean',
			default: false,
			markdownDescription: localize('notebook.diff.ignoreOutputs', "Hide Outputs Differences")
		},
	}
});
