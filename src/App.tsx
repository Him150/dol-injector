import { Button, ButtonGroup, Card, Input, Modal, Spinner, Skeleton } from '@heroui/react';
import { RefreshCcw, Save, Trash, DownloadIcon } from 'lucide-react';
import { trimPrefix, useFeatures } from './features';

export default function App() {
  const {
    open,
    setOpen,
    items,
    name,
    setName,
    del,
    setDel,
    listLoading,
    actionLoading,
    openModal,
    refresh,
    saveByName,
    loadByName,
    deleteByName,
  } = useFeatures();
  const ioLoading = actionLoading === 'save' || actionLoading === 'load' || actionLoading === 'delete';

  return (
    <>
      <Button className='fixed top-1 right-1 z-50' size='sm' isIconOnly onPress={openModal}>
        <Save className='w-4 h-4'></Save>
      </Button>

      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop variant='blur'>
          <Modal.Container placement='center'>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className='flex flex-row items-center'>
                <span className='text-xl font-bold'>存档管理</span>
                <Button
                  isIconOnly
                  size='sm'
                  variant='tertiary'
                  onPress={refresh}
                  isDisabled={listLoading || !!actionLoading}>
                  <RefreshCcw className='w-4 h-4' />
                </Button>
                {ioLoading && <Spinner />}
              </Modal.Header>

              <Modal.Body className='flex flex-col gap-4 p-2'>
                <div className='flex gap-2'>
                  <Input
                    className='w-full'
                    placeholder='文件名'
                    value={name}
                    onChange={e => setName(e.target.value.replaceAll('/', '').replaceAll('\\', ''))}
                  />
                  <Button onPress={() => saveByName(name)} isDisabled={!name.trim() || ioLoading}>
                    <Save className='w-4 h-4'></Save>
                  </Button>
                </div>

                <Card className='p-1'>
                  {listLoading &&
                    Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className='p-3 flex flex-row gap-1 justify-between not-last-of-type:border-b'>
                        <div className='w-full flex items-center'>
                          <Skeleton className='h-6 w-full rounded-md' />
                        </div>
                        <Skeleton className='h-8 w-36 rounded-full' />
                      </div>
                    ))}

                  {!listLoading &&
                    items.map(item => {
                      const fileName = trimPrefix(item.path);
                      return (
                        <div key={fileName} className='p-3 flex flex-row flex-wrap gap-1 not-last-of-type:border-b'>
                          <span className='flex items-center'>{decodeURIComponent(fileName)}</span>
                          <div className='ml-auto flex gap-2'>
                            <ButtonGroup>
                              <Button
                                size='sm'
                                variant='tertiary'
                                onPress={() => loadByName(fileName)}
                                isDisabled={ioLoading}>
                                <DownloadIcon className='w-4 h-4'></DownloadIcon>加载
                              </Button>
                              <Button size='sm' onPress={() => saveByName(fileName)} isDisabled={ioLoading}>
                                <Save className='w-4 h-4'></Save>保存
                              </Button>
                              <Button
                                size='sm'
                                variant='danger'
                                onPress={() => setDel(fileName)}
                                isDisabled={ioLoading}>
                                <Trash className='w-4 h-4'></Trash>删除
                              </Button>
                            </ButtonGroup>
                          </div>
                        </div>
                      );
                    })}
                </Card>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={!!del} onOpenChange={() => setDel(null)}>
        <Modal.Backdrop>
          <Modal.Container placement='center'>
            <Modal.Dialog>
              <Modal.Header className='text-xl font-bold'>确认删除</Modal.Header>
              <Modal.Body>删除 {decodeURIComponent(del ?? '')}?</Modal.Body>
              <Modal.Footer>
                <Button onPress={() => setDel(null)} isDisabled={actionLoading === 'delete'}>
                  取消
                </Button>
                <Button onPress={() => del && deleteByName(del)} variant='danger' isDisabled={!del || ioLoading}>
                  确认
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
